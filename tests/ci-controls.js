function runCiControlsTests(api) {
  const passed = [], assert = (value, message) => { if (!value) throw new Error(message); };
  function test(name, fn) { fn(); passed.push(name); }
  const base = () => ({ migrations: [], bootstrap_ready: true, current_metadata: { status: 'verified' } });
  test('missing original SQL blocks even a forged ready flag', () => {
    const inventory = base(); inventory.migrations.push({version:'20261031105609',name:'security_phase1_restrict_public_player_writes',status:'missing_historical_sql'});
    const result = api.baselineStatus(inventory, []);
    assert(result.status === 'BLOCKED' && result.missing[0] === '20261031105609_security_phase1_restrict_public_player_writes.sql', 'Missing original was hidden');
  });
  test('unreviewed history blocks with no missing names', () => {
    const inventory = base(); inventory.bootstrap_ready = false;
    assert(api.baselineStatus(inventory, []).status === 'BLOCKED', 'Unreviewed history was accepted');
  });
  test('unverified current metadata blocks', () => {
    const inventory = base(); inventory.current_metadata.status = 'unavailable';
    assert(api.baselineStatus(inventory, []).status === 'BLOCKED', 'Stale metadata was accepted');
  });
  test('unexpected SQL file fails instead of marking bootstrap ready', () => {
    let caught = false; try { api.baselineStatus(base(), ['unexpected.sql']); } catch (_) { caught = true; }
    assert(caught, 'Unreviewed migration was accepted');
  });
  test('ready means prerequisites ready, never database tests passed', () => {
    const result = api.baselineStatus(base(), []);
    assert(result.status === 'READY' && result.databaseTestsExecuted === false, 'Gate fabricated a database result');
  });
  test('artifact output removes JWTs and generated Supabase keys', () => {
    const text = api.redact('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature sb_secret_fixture123 sb_publishable_fixture456');
    assert(!text.includes('eyJ') && !text.includes('fixture'), 'A key leaked');
  });
  test('artifact output removes local credentials and session fields', () => {
    const text = api.redact('postgresql://postgres:localpass@127.0.0.1/db\n{"refresh_token":"opaque123","password":"abc123"}\nAuthorization: Bearer opaque456\nfixture@example.invalid');
    assert(!/localpass|opaque123|abc123|opaque456|fixture@example/.test(text), 'A credential or email leaked');
  });
  test('artifact output removes secrets supplied as environment values', () => {
    assert(api.redact('echo sensitive-runtime-value', {RPG_TEST_SERVICE_ROLE_KEY:'sensitive-runtime-value'}) === 'echo [redacted]', 'Runtime secret leaked');
  });
  test('diagnostic failures remain readable after sanitization', () => {
    assert(api.redact('ERROR: relation public.players does not exist') === 'ERROR: relation public.players does not exist', 'Diagnostic was lost');
  });
  return passed;
}
