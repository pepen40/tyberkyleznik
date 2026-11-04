'use strict';
// Read-only operator checks. Does not install tools, link projects or print keys.
const {spawnSync}=require('node:child_process');
function environment(env=process.env){
  for(const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID','SUPABASE_DB_PASSWORD','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'])
    if(env[name])throw Error('Remove inherited hosted/backend variable: '+name);
  if(env.DOCKER_HOST && !env.DOCKER_HOST.startsWith('unix://'))throw Error('Local Unix Docker socket required');
}
function localDocker(endpoint){if(typeof endpoint!=='string'||!endpoint.startsWith('unix:///'))throw Error('Docker context must use a local Unix socket');}
function capture(bin,args){
  const result=spawnSync(bin,args,{encoding:'utf8',timeout:15000});
  if(result.error||result.status!==0)throw Error('Unavailable prerequisite: '+bin+' '+args.join(' '));
  return (result.stdout||'')+(result.stderr||'');
}
function doctor(){
  environment();
  if(process.platform!=='linux')throw Error('Run doctor on the separate Linux test host');
  if(Number(process.versions.node.split('.')[0])!==22)throw Error('Use Node22, matching the verified runner');
  const context=JSON.parse(capture('docker',['context','inspect']));
  localDocker(process.env.DOCKER_HOST||context[0]?.Endpoints?.docker?.Host);
  capture('docker',['info','--format','{{.ServerVersion}}']);
  if(!/^2\.84\.2\s*$/m.test(capture('supabase',['--version'])))throw Error('Use Supabase CLI 2.84.2');
  capture('psql',['--version']);capture('git',['--version']);capture('ssh',['-V']);
  const compose=spawnSync('docker',['compose','version'],{encoding:'utf8',timeout:15000});
  console.log('PASS: Linux, Node22, local Docker daemon, pinned Supabase CLI, psql, Git, SSH');
  console.log('Compose plugin: '+(compose.status===0?'available':'not installed (not required: the pinned CLI orchestrates its own containers)'));
}
async function verifyFrontend(base,fetcher=fetch){
  const url=new URL(base);
  if(url.origin!==base||url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw Error('Loopback frontend origin required');
  const get=route=>fetcher(base+route,{signal:AbortSignal.timeout(5000),redirect:'error'});
  const script=await get('/script.js');if(script.status!==200)throw Error('Frontend script unavailable');
  const source=await script.text();
  if(!source.includes('window.PEPEN_CLOSED_TEST = true;')||!source.includes("window.location.origin + '/backend'")||/https:\/\/[^'"\s]+\.supabase\.co/.test(source))throw Error('Closed-test frontend rewrite is missing or references a hosted backend');
  for(const route of ['/backend/auth/v1/admin/users','/backend/auth/v1/signup','/.runtime/closed-test-stack/.env']){
    const result=await get(route);if(![403,404].includes(result.status))throw Error('Private route is exposed: '+route);
  }
  if((await get('/backend/auth/v1/health')).status!==200)throw Error('Local Auth unavailable through proxy');
}
async function verify(directory){
  environment();
  const {isolated,localSettings}=require('./manage.cjs');
  const settings=localSettings(isolated(directory)); // Checks loopback URL and generated key signatures.
  await verifyFrontend('http://127.0.0.1:8080');
  for(const name of ['award-coins','rpg-pvp']){
    const response=await fetch('http://127.0.0.1:8080/backend/functions/v1/'+name,{method:'POST',headers:{Authorization:'Bearer '+settings.ANON_KEY,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
    if(response.status!==401)throw Error('Edge '+name+' must be running and reject anonymous access with 401');
  }
  console.log('PASS: generated local keys, private frontend/proxy, Auth, both Edge auth gates');
  console.log('Account login and gameplay: use issued accounts; this check does not simulate player success');
}
if(require.main===module)Promise.resolve().then(()=>{
  const [mode,directory]=process.argv.slice(2);
  if(mode==='doctor')return doctor();if(mode==='verify')return verify(directory);
  throw Error('Expected doctor or verify [stack-directory]');
}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={environment,localDocker,verifyFrontend};
