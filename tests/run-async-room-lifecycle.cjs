const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'async-room-lifecycle.js'),'utf8');
vm.runInNewContext(tests+'\nrunAsyncRoomLifecycleTests')(source).then(console.log).catch(error=>{console.error(error);process.exitCode=1;});
