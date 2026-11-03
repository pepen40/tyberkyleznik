'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
if (process.env.GITHUB_ACTIONS !== 'true' || !fs.existsSync('.ci-disposable')) throw new Error('Disposable CI harness required');
const values = {};
for (const line of execFileSync('supabase', ['status', '-o', 'env'], {encoding:'utf8', stdio:['ignore','pipe','pipe']}).split(/\r?\n/)) {
  const match = /^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)="?([^"\r\n]+)"?$/.exec(line);
  if (match) values[match[1]] = match[2];
}
if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY || new URL(values.API_URL).hostname !== '127.0.0.1') throw new Error('Missing or non-loopback local settings');
for (const name of ['ANON_KEY', 'SERVICE_ROLE_KEY']) console.log('::add-mask::' + values[name]);
fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(values).map(([name,value]) => 'RPG_TEST_' + name + '=' + value).join('\n') + '\n');
