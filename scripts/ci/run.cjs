'use strict';
// Only this sanitized directory is uploaded. Never upload the workspace/temp tree.
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { redact } = require('./controls.cjs');
const [name, command, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(name || '') || !command) throw new Error('Expected a safe result name and command');
const directory = path.resolve(__dirname, '../../.runtime/ci/safe');
fs.mkdirSync(directory, { recursive: true });
const started = Date.now();
const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: process.env });
const code = result.status === null ? 1 : result.status;
const log = redact((result.stdout || '') + (result.stderr || '') + (result.error ? '\n' + result.error.message : ''), process.env);
fs.writeFileSync(path.join(directory, name + '.log'), log);
fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify({ name, status: code === 0 ? 'PASSED' : 'FAILED', exitCode: code, durationMs: Date.now() - started }, null, 2));
process.stdout.write(log);
process.exitCode = code;
