const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const tests = fs.readFileSync(path.join(__dirname, 'chess-invitations.js'), 'utf8');
vm.runInNewContext(tests + '\nrunChessInvitationTests')(source).then(console.log).catch(error => { console.error(error); process.exitCode = 1; });
