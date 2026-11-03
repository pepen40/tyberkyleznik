'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('script.js','utf8');
let handler,reloads=0;
const env={supabase:{createClient:()=>({auth:{onAuthStateChange:fn=>{handler=fn;}}})},window:{location:{reload:()=>reloads++}},queueMicrotask:fn=>fn(),currentAuthUserId:'old',currentUser:'old',rpgChar:{},rpgEnemy:{}};
vm.runInNewContext(source.slice(0,source.indexOf('const EDGE_FUNCTION_NAME')),env);
handler('SIGNED_OUT');
assert.equal(env.currentAuthUserId,null,'Auth signout left old actor active');
assert.equal(env.currentUser,null);
assert.equal(reloads,1,'Old document and its channels must be retired');
console.log('PASS: SDK signout invalidates actor and retires the old document');
async function checkLateProfile(){
  let resolve;
  const noop=()=>{};
  const state={authSessionGeneration:0,currentAuthUserId:null,currentUser:null,currentHighScore:0,currentCoins:0,currentInventory:[],currentItemPoints:0,currentPvpPts:0,currentUpgrades:{},currentMaxFloors:{},
    window:{},supabaseClient:{functions:{invoke:()=>new Promise(ok=>{resolve=ok;})}},ensureRpgGear:noop,initRpgInvitationInbox:async()=>false,
    document:{getElementById:()=>({classList:{add:noop,remove:noop}})},startSheep:noop,startRoachSchedule:noop,ROACH_FIRST_DELAY:1,preloadSounds:noop,initOnlineCounter:noop,initSiteGlobalChat:noop,updateUI:noop,resetGame:noop,renderCharStats:noop,switchTab:noop};
  const text=source.slice(source.indexOf('async function finishAuthLogin('),source.indexOf('async function restoreAuthSession('));
  const fn=new Function('env','with(env){return ('+text.trim()+');}')(state);
  const request=fn({id:'old'});state.authSessionGeneration++;
  resolve({data:{success:true,profile:{user_id:'old',username:'old'}}});await request;
  assert.equal(state.currentAuthUserId,null,'Late profile restored a signed-out actor');
  console.log('PASS: late profile cannot resurrect a retired Auth session');
}
checkLateProfile().catch(error=>{console.error(error);process.exitCode=1;});
