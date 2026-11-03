const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const run=vm.runInNewContext(read('tests/server-invitations.js')+'\nrunServerInvitationTests');
run(read('chess-delivery.js'),read('tests/fixtures/chess-invite-answer.before.js'),read('supabase/functions/award-coins/index.ts')).then(console.log).catch(error=>{console.error(error);process.exitCode=1;});
