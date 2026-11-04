'use strict';
const assert=require('node:assert/strict');
const {environment,localDocker,verifyFrontend}=require('../closed-test/host-check.cjs');
async function run(){
  environment({});localDocker('unix:///var/run/docker.sock');
  for(const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID','SUPABASE_DB_PASSWORD','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'])assert.throws(()=>environment({[name]:'fixture-not-a-secret'}));
  assert.throws(()=>environment({DOCKER_HOST:'tcp://remote:2375'}));
  assert.throws(()=>localDocker('ssh://remote'));
  let hosted=false,authStatus=200;
  const mock=async url=>({status:url.endsWith('script.js')?200:url.endsWith('health')?authStatus:url.includes('.env')?404:403,text:async()=>hosted?"const SUPABASE_URL='https://fixture.supabase.co';":"window.PEPEN_CLOSED_TEST = true; const SUPABASE_URL=window.location.origin + '/backend';"});
  await verifyFrontend('http://127.0.0.1:8080',mock);
  hosted=true;await assert.rejects(()=>verifyFrontend('http://127.0.0.1:8080',mock));
  hosted=false;authStatus=503;await assert.rejects(()=>verifyFrontend('http://127.0.0.1:8080',mock));
  await assert.rejects(()=>verifyFrontend('https://example.com',mock));
  console.log('PASS: host checks reject hosted credentials/remote Docker, unsafe frontend and failed Auth health (unit scope)');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
