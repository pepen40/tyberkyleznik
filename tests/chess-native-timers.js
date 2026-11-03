async function runChessNativeTimerTests(source, reportFailures = false) {
  const passed = [], failures = [];
  const factory = new Function(source + '\nreturn {createChessDelivery,createServerChessInvitations};')();
  const assert = (value, message) => { if (!value) throw new Error(message); };
  async function test(name, fn) {
    try { await fn(); passed.push(name); }
    catch (error) { if (!reportFailures) throw error; failures.push({name,error:error.message}); }
  }
  function timers() {
    const calls = [];
    // Browser-native timers reject an arbitrary options object as their receiver.
    // Strict probes record that receiver without causing an unhandled rejection.
    return { calls,
      setTimer: function () { 'use strict'; calls.push({kind:'set',receiver:this}); return calls.length; },
      clearTimer: function () { 'use strict'; calls.push({kind:'clear',receiver:this}); },
    };
  }
  await test('peer delivery invokes injected native timer callbacks without rebinding this', () => {
    const clock = timers();
    const api = factory.createChessDelivery({ ...clock, roomId:'room',from:'host',peer:'guest',send:()=>Promise.resolve(),
      history:()=>[],applyMove:()=>true,status:()=>{},chat:()=>{},resign:()=>{},isCurrent:()=>true,newId:()=> 'message' });
    api.setConnected(true); api.setConnected(true); api.dispose();
    assert(clock.calls.some(call=>call.kind==='set') && clock.calls.some(call=>call.kind==='clear'), 'Timers did not run');
    assert(clock.calls.every(call=>call.receiver === undefined), 'Timer received the options object instead of a standalone call');
  });
  await test('invitation polling and stop invoke injected native timers without rebinding this', async () => {
    const clock = timers();
    const api = factory.createServerChessInvitations({ ...clock, account:()=>null,username:()=>'',invoke:async()=>{throw Error('No Auth call expected');} });
    api.subscribe(()=>{}); await Promise.resolve(); api.stop();
    assert(clock.calls.some(call=>call.kind==='set') && clock.calls.some(call=>call.kind==='clear'), 'Poll timers did not run');
    assert(clock.calls.every(call=>call.receiver === undefined), 'Poll timer received the options object');
  });
  return reportFailures ? {passed,failures} : passed;
}
