const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'account-callbacks.js'),'utf8');
const run=vm.runInNewContext(tests+'\nrunAccountCallbackTests');
Promise.all([run(source),run(source,false,false)]).then(([stale,current])=>console.log({stale,current})).catch(error=>{console.error(error);process.exitCode=1;});
