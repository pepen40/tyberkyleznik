const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
new vm.Script(source, { filename: 'script.js' });
const tests = fs.readFileSync(path.join(__dirname, 'rpg-lifecycle.js'), 'utf8');
const run = vm.runInNewContext(tests + '\nrunRpgLifecycleTests');
run(source).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
