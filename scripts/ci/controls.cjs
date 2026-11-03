'use strict';

function redact(text, env = {}) {
  let safe = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  for (const [name, value] of Object.entries(env)) {
    if (/TOKEN|KEY|PASS|SECRET|DB_URL|DATABASE_URL/i.test(name) && typeof value === 'string' && value.length >= 8) {
      safe = safe.split(value).join('[redacted]');
    }
  }
  return safe
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted key]')
    .replace(/(\b(?:postgres(?:ql)?|https?):\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/((?:["']?(?:access_token|refresh_token|password|service_role_key|authorization|cookie)["']?)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,}]+)/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]');
}

function baselineStatus(inventory, localNames) {
  const rows = inventory.migrations;
  if (!Array.isArray(rows)) throw new Error('Invalid migration inventory');
  const versions = rows.map(row => row.version);
  if (new Set(versions).size !== versions.length) throw new Error('Duplicate migration version');
  const missing = rows.filter(row => row.status === 'missing_historical_sql')
    .map(row => row.version + '_' + row.name + '.sql');
  const tracked = rows.filter(row => row.status !== 'missing_historical_sql').map(row => {
    if (!['tracked_recorded_applied', 'not_in_recorded_applied_snapshot'].includes(row.status)) throw new Error('Unknown inventory status');
    if (row.path !== 'supabase/migrations/' + row.version + '_' + row.name + '.sql') throw new Error('Invalid tracked migration path');
    return row.path.split('/').pop();
  });
  if (tracked.length !== localNames.length || tracked.some(name => !localNames.includes(name))) throw new Error('Local migration set differs from reviewed inventory');
  const reasons = [];
  if (missing.length) reasons.push('Original SQL is missing for ' + missing.length + ' recorded-applied migrations');
  if (inventory.bootstrap_ready !== true) reasons.push('Historical baseline has not been recovered/reviewed');
  if (inventory.current_metadata?.status !== 'verified') reasons.push('Current production metadata/source correspondence is unverified');
  return { status: reasons.length ? 'BLOCKED' : 'READY', missing, reasons, databaseTestsExecuted: false };
}

module.exports = { redact, baselineStatus };
