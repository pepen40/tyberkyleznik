const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'game-timers.js'),'utf8');
console.log(vm.runInNewContext(tests+'\nrunGameTimerTests')(source));
