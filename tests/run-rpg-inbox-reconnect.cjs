'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('script.js','utf8');
async function run(){
  let callback,notify,removed=0;
  const subscribed=new Promise(ok=>{notify=ok;});
  const channel={subscribe(fn){callback=fn;notify();}};
  const env={rpgInvitationChannel:null,rpgInvitationChannelStatus:'CLOSED',rpgInvitationRemovalPromise:Promise.resolve(),
    supabaseClient:{auth:{getSession:async()=>({data:{session:{access_token:'test-only',user:{id:'tester'}}}})},realtime:{setAuth:async()=>{}},channel:()=>channel,removeChannel:async()=>{removed++;}},
    listenForChallenges(){},getSafeRealtimeErrorMessage:String,console:{info(){},warn(){},error(){}},setTimeout:()=>1,clearTimeout(){},pendingOutgoingChallenge:null};
  const code=source.slice(source.indexOf('async function initializeRpgInvitationInbox('),source.indexOf('async function clearOutgoingRpgChallenge('));
  const fn=new Function('env','with(env){return ('+code.trim()+');}')(env);
  const initial=fn('tester');await subscribed;callback('SUBSCRIBED');assert.equal(await initial,true);
  callback('CHANNEL_ERROR');
  assert.equal(removed,0,'Transient disconnect destroyed the receiver instead of letting Realtime reconnect');
  assert.equal(env.rpgInvitationChannel,channel);
  callback('SUBSCRIBED');assert.equal(env.rpgInvitationChannelStatus,'SUBSCRIBED');
  console.log('PASS: subscribed RPG inbox survives disconnect and resumes on the same channel');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
