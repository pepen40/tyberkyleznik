const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const tests=fs.readFileSync(path.join(__dirname,'invitation-preferences.js'),'utf8');
vm.runInNewContext(tests+'\nrunInvitationPreferenceTest')(source).then(console.log).catch(error=>{console.error(error);process.exitCode=1;});
