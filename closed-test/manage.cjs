'use strict';
// Creates a NEW local test application schema. Never links a hosted project.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function command(bin, args, cwd) { return execFileSync(bin,args,{cwd,stdio:'inherit'}); }
function isolated(directory) {
  const target = path.resolve(directory || path.join(root,'.runtime/closed-test-stack'));
  if (!target.startsWith(path.join(root,'.runtime')+path.sep)) throw Error('Test stack must stay inside this checkout/.runtime');
  if (process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PROJECT_ID || process.env.SUPABASE_DB_PASSWORD) throw Error('Hosted credentials are forbidden');
  if (fs.existsSync(path.join(target,'supabase/.temp/project-ref'))) throw Error('Linked project is forbidden');
  return target;
}
function marker(directory) {
  const result=JSON.parse(fs.readFileSync(path.join(directory,'.closed-test-profile'),'utf8'));
  if (result.profile!=='isolated-v1') throw Error('Closed-test marker required');
  return result;
}
function localCommand(directory,args) { return command('supabase',['--network-id',marker(directory).projectId+'_loopback',...args],directory); }
function localSettings(directory) {
  marker(directory);
  const text=execFileSync('supabase',['status','-o','env'],{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const values={};
  for (const line of text.split(/\r?\n/)) { const match=/^(API_URL|DB_URL|ANON_KEY|SERVICE_ROLE_KEY)="?([^"\r\n]+)"?$/.exec(line); if(match) values[match[1]]=match[2]; }
  if(new URL(values.API_URL).hostname!=='127.0.0.1' || new URL(values.DB_URL).hostname!=='127.0.0.1') throw Error('Loopback backend required');
  const secret=fs.readFileSync(path.join(directory,'.env'),'utf8').match(/^PEPEN_TEST_JWT_SECRET=(.+)$/m)?.[1];
  for(const [name,role] of [['ANON_KEY','anon'],['SERVICE_ROLE_KEY','service_role']]) {
    const parts=String(values[name]).split('.');
    const signature=crypto.createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest('base64url');
    if(parts[2]!==signature || JSON.parse(Buffer.from(parts[1],'base64url')).role!==role) throw Error('Stack does not use the generated private test signing secret');
  }
  return values;
}
function prepare(directory) {
  if(fs.existsSync(directory)) throw Error('Refusing to reuse an existing directory; keep the old isolated data and choose another .runtime path');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  command('supabase',['init'],directory);
  const config=path.join(directory,'supabase/config.toml');
  let text=fs.readFileSync(config,'utf8');
  const id='pepen_closed_'+crypto.randomBytes(6).toString('hex');
  text=text.replace(/^project_id\s*=.*$/m,'project_id = '+JSON.stringify(id));
  text=text.replace(/^(\s*major_version\s*=\s*)\d+/m,(_line,prefix)=>prefix+'17');
  const secret=crypto.randomBytes(48).toString('hex');
  const token=role=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const payload=Buffer.from(JSON.stringify({iss:'supabase',role,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+172800})).toString('base64url');return header+'.'+payload+'.'+crypto.createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');};
  fs.writeFileSync(path.join(directory,'.env'),'PEPEN_TEST_JWT_SECRET='+secret+'\nPEPEN_TEST_ANON_KEY='+token('anon')+'\nPEPEN_TEST_SERVICE_KEY='+token('service_role')+'\n',{mode:0o600});
  // Only modify the [auth] section; email signup is disabled independently too.
  text=text.replace(/\[auth\]\n([\s\S]*?)(?=\n\[|$)/,(_whole,section)=>'[auth]\n'+section.replace(/^enable_signup\s*=.*$/m,'enable_signup = false').replace(/^jwt_expiry\s*=.*$/m,'jwt_expiry = 900')+'\njwt_secret = "env(PEPEN_TEST_JWT_SECRET)"\nanon_key = "env(PEPEN_TEST_ANON_KEY)"\nservice_role_key = "env(PEPEN_TEST_SERVICE_KEY)"\n');
  text=text.replace(/\[auth.email\]\n([\s\S]*?)(?=\n\[|$)/,(_whole,section)=>'[auth.email]\n'+section.replace(/^enable_signup\s*=.*$/m,'enable_signup = false'));
  fs.writeFileSync(config,text);
  fs.writeFileSync(path.join(directory,'.closed-test-profile'),JSON.stringify({profile:'isolated-v1',projectId:id}));
  const functions=path.join(directory,'supabase/functions');fs.mkdirSync(functions,{recursive:true});
  for(const name of ['award-coins','rpg-pvp','_shared']) fs.cpSync(path.join(root,'supabase/functions',name),path.join(functions,name),{recursive:true});
  fs.writeFileSync(path.join(functions,'.env'),'PEPEN_CLOSED_TEST=true\n',{mode:0o600});
  console.log('Prepared NEW isolated-v1 schema; historical bootstrap remains separate/BLOCKED');
}
function start(directory) {
  const info=marker(directory), network=info.projectId+'_loopback';
  try { execFileSync('docker',['network','inspect',network],{stdio:'ignore'}); }
  catch { command('docker',['network','create','--driver','bridge','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network],directory); }
  command('supabase',['start','--network-id',network,'--exclude','imgproxy,storage-api,mailpit,postgres-meta,studio,logflare,vector,supavisor'],directory);
  localSettings(directory);
}
function apply(directory) {
  const values=localSettings(directory);
  command('psql',[values.DB_URL,'-X','-v','ON_ERROR_STOP=1','-f',path.join(__dirname,'sql/010_foundation.sql')],directory);
  const scopes=JSON.parse(fs.readFileSync(path.join(root,'.github/ci/migration-scopes.json'),'utf8'));
  const names=[...new Set(Object.values(scopes).flatMap(scope=>scope.migrations))].sort();
  fs.mkdirSync(path.join(directory,'supabase/migrations'),{recursive:true});
  fs.mkdirSync(path.join(directory,'supabase/tests'),{recursive:true});
  for(const name of names) fs.copyFileSync(path.join(root,'supabase/migrations',name),path.join(directory,'supabase/migrations',name));
  localCommand(directory,['migration','up','--local']);
  command('psql',[values.DB_URL,'-X','-v','ON_ERROR_STOP=1','-f',path.join(__dirname,'sql/020_realtime_guard.sql')],directory);
}
async function request(values,route,body,service=true) {
  const key=service?values.SERVICE_ROLE_KEY:values.ANON_KEY;
  const response=await fetch(values.API_URL+route,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await response.text(),data=text?JSON.parse(text):null;if(!response.ok) throw Error('Local provisioning request failed: '+response.status);
  return data;
}
async function addUser(directory,username,allowed=true) {
  if(!/^[a-zA-Zа-яА-Я0-9_]{3,20}$/.test(username)) throw Error('Invalid tester username');
  const values=localSettings(directory),password=crypto.randomBytes(24).toString('base64url');
  const email=Buffer.from(username.toLowerCase()).toString('hex')+'@username.pepen.invalid';
  const user=await request(values,'/auth/v1/admin/users',{email,password,email_confirm:true});
  if(allowed) await request(values,'/rest/v1/rpc/provision_closed_test_player',{p_user_id:user.id,p_username:username});
  return {username,password,id:user.id};
}
async function main() {
  const [operation,requested,username]=process.argv.slice(2), directory=isolated(requested);
  if(operation==='prepare') return prepare(directory);
  marker(directory);
  if(operation==='start') return start(directory);
  if(operation==='apply') return apply(directory);
  if(operation==='functions') return localCommand(directory,['functions','serve']);
  if(operation==='stop') return localCommand(directory,['stop']);
  if(operation==='test-db') { localSettings(directory); return localCommand(directory,['test','db','--local']); }
  if(operation==='seed-ci') {
    if(process.env.GITHUB_ACTIONS!=='true') throw Error('seed-ci is only for ephemeral CI accounts');
    const users=[];for(const [name,allowed] of [['tester_a',true],['tester_b',true],['outsider',false]]) users.push(await addUser(directory,name,allowed));
    const values=localSettings(directory);
    fs.writeFileSync(path.join(directory,'ci-users.json'),JSON.stringify({url:values.API_URL,publicKey:values.ANON_KEY,users}),{mode:0o600});
    return console.log('Three disposable CI identities created; credentials are NOT logged or uploaded');
  }
  if(operation==='add-user') {
    if(!process.stdout.isTTY) throw Error('add-user must be run in a private interactive terminal');
    const user=await addUser(directory,username);console.log('Tester: '+user.username+'\nOne-time test password: '+user.password+'\nShare privately. No production account is involved.');return;
  }
  if(operation==='serve') {
    const values=localSettings(directory);
    const {frontend,stop}=await require('../tests/e2e/local-server.cjs').startLocalSite(new URL(values.API_URL),values.ANON_KEY,{closedTest:true,port:8080});
    console.log('Closed test on '+frontend+'; expose ONLY this port through authenticated SSH forwarding. Backend stays loopback.');
    const timer=setTimeout(stop,24*60*60*1000);timer.unref();return;
  }
  throw Error('Expected prepare/start/apply/functions/test-db/seed-ci/add-user/serve/stop');
}
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={isolated,localSettings,prepare,start,apply,addUser};
