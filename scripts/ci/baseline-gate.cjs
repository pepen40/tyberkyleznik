'use strict';
const fs = require('node:fs'), path = require('node:path');
const { baselineStatus } = require('./controls.cjs');
const root = path.resolve(__dirname, '../..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/migration-inventory.json'), 'utf8'));
const names = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql'));
const report = baselineStatus(inventory, names);
const directory = path.join(root, '.runtime/ci/safe');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'full-bootstrap.json'), JSON.stringify(report, null, 2));
const summary = '## Full historical bootstrap: ' + report.status + '\n\n' + report.reasons.map(reason => '- ' + reason).join('\n') +
  '\n\nMissing original migration sources:\n\n' + report.missing.map(name => '- `' + name + '`').join('\n') +
  '\n\nNarrow fixture tests and browser DOM smoke do not establish full bootstrap or online E2E readiness.\n';
fs.writeFileSync(path.join(directory, 'full-bootstrap.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'status=' + report.status + '\n');
console.log(summary);
// The workflow enforces BLOCKED as a failing check after collecting artifacts.
