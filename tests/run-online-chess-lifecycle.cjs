const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
new vm.Script(source);
const tests = fs.readFileSync(path.join(__dirname, 'online-chess-lifecycle.js'), 'utf8');
const run = vm.runInNewContext(tests + '\nrunOnlineChessLifecycleTests');
run(source).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
