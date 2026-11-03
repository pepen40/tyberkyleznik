const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'frontend-widgets.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
new vm.Script(script, { filename: 'script.js' });
if (script.includes('function initPerformanceOverlay(')) {
  throw new Error('Duplicate script.js performance monitor must not return');
}
const run = vm.runInNewContext(source + '\nrunFrontendWidgetTests');
console.log(JSON.stringify(run(html), null, 2));
