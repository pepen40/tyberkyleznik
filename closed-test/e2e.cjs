'use strict';
const fs=require('node:fs'),path=require('node:path');
const directory=path.resolve(process.argv[2] || '.runtime/closed-test-stack');
const fixture=JSON.parse(fs.readFileSync(path.join(directory,'ci-users.json'),'utf8'));
Object.assign(process.env,{
  E2E_DISPOSABLE_LOCAL:'true',E2E_CLOSED_TEST:'true',E2E_RUN_REAL_TIMEOUT:'true',
  SUPABASE_TEST_URL:fixture.url,SUPABASE_TEST_PUBLIC_KEY:fixture.publicKey,
  E2E_USER_A:fixture.users[0].username,E2E_PASS_A:fixture.users[0].password,
  E2E_USER_B:fixture.users[1].username,E2E_PASS_B:fixture.users[1].password,
  E2E_USER_OUT:fixture.users[2].username,E2E_PASS_OUT:fixture.users[2].password,
});
require('../tests/e2e/local-online.cjs');
