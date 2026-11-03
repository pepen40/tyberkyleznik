const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../chess-delivery.js'),'utf8');
const tests = fs.readFileSync(path.join(__dirname,'chess-native-timers.js'),'utf8');
vm.runInNewContext(tests + '\nrunChessNativeTimerTests')(source)
  .then(result=>console.log(result)).catch(error=>{console.error(error);process.exitCode=1;});
