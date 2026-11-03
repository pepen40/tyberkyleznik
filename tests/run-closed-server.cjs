'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {startLocalSite}=require('./e2e/local-server.cjs');
async function run(){
  const observed=[];
  const backend=http.createServer((req,res)=>{observed.push({path:req.url,key:req.headers.apikey});res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}');});
  await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
  const url=new URL('http://127.0.0.1:'+backend.address().port),key='sb_publishable_test_only';
  let site;
  try {
    await assert.rejects(()=>startLocalSite(url,'e30.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.fixture'));
    site=await startLocalSite(url,key,{closedTest:true});
    const script=await (await fetch(site.frontend+'/script.js')).text();
    assert(script.includes("window.location.origin + '/backend'") && script.includes('PEPEN_CLOSED_TEST = true'));
    assert(!script.includes('zfvinbamwavibnhmfwnz.supabase.co'));
    assert.equal((await fetch(site.frontend+'/backend/auth/v1/admin/users')).status,403);
    assert.equal((await fetch(site.frontend+'/backend/auth/v1/signup')).status,403);
    assert.equal((await fetch(site.frontend+'/.runtime/secret.json')).status,404);
    await fetch(site.frontend+'/backend/rest/v1/players',{headers:{apikey:'attacker-key'}});
    assert.deepEqual(observed,[{path:'/rest/v1/players',key}]);
    console.log('PASS: closed-test server rewrites only to same-origin loopback proxy, rejects privileged keys/admin paths and hides private files');
  } finally {if(site)await site.stop();await new Promise(resolve=>backend.close(resolve));}
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
