const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const api = require('../scripts/ci/controls.cjs');
const tests = fs.readFileSync(path.join(__dirname, 'ci-controls.js'), 'utf8');
console.log(vm.runInNewContext(tests + '\nrunCiControlsTests')(api));
