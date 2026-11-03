#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "$(cat .ci-disposable)" == invitation ]]
[[ "${RPG_TEST_API_URL:-}" =~ ^http://127\.0\.0\.1:[0-9]+$ ]] || { echo 'Loopback test API required' >&2; exit 1; }
umask 077
# CLI supplies the local container URL and service role automatically.
nohup supabase functions serve award-coins \
  > "$RUNNER_TEMP/rpg-invitation-edge.log" 2>&1 &
echo $! > "$RUNNER_TEMP/rpg-invitation-edge.pid"

probe_email="rpg-edge-probe-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.test"
probe_password="$(openssl rand -hex 24)"
probe_user_response="$RUNNER_TEMP/rpg-invitation-probe-user.json"
curl --silent --show-error --fail-with-body \
  --request POST "$RPG_TEST_API_URL/auth/v1/admin/users" \
  --header "apikey: $RPG_TEST_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $RPG_TEST_SERVICE_ROLE_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$probe_email" --arg password "$probe_password" \
    '{email:$email,password:$password,email_confirm:true}')" \
  > "$probe_user_response"
probe_user_id="$(jq -r '.id // empty' "$probe_user_response")"
if [[ -z "$probe_user_id" ]]; then
  echo "Could not create a disposable Auth user for Edge readiness." >&2
  exit 1
fi
printf '%s' "$probe_user_id" > "$RUNNER_TEMP/rpg-invitation-probe-user-id"

probe_session_response="$RUNNER_TEMP/rpg-invitation-probe-session.json"
curl --silent --show-error --fail-with-body \
  --request POST "$RPG_TEST_API_URL/auth/v1/token?grant_type=password" \
  --header "apikey: $RPG_TEST_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$probe_email" --arg password "$probe_password" \
    '{email:$email,password:$password}')" \
  > "$probe_session_response"
probe_access_token="$(jq -r '.access_token // empty' "$probe_session_response")"
if [[ -z "$probe_access_token" ]]; then
  echo "Could not authenticate the disposable Edge readiness user." >&2
  exit 1
fi

for attempt in $(seq 1 60); do
  status="$(curl --silent --output "$RUNNER_TEMP/rpg-invitation-edge-probe.json" \
    --write-out '%{http_code}' \
    --request POST "$RPG_TEST_API_URL/functions/v1/award-coins" \
    --header "apikey: $RPG_TEST_ANON_KEY" \
    --header "Authorization: Bearer $probe_access_token" \
    --header 'Content-Type: application/json' \
    --data '{"action":"ci_readiness_probe"}' || true)"
  if [[ "$status" == 400 ]] && jq -e \
    '.success == false and (.error | type == "string" and length > 0)' \
    "$RUNNER_TEMP/rpg-invitation-edge-probe.json" >/dev/null 2>&1; then
    echo "Local award-coins Edge Function is ready (HTTP $status)."
    exit 0
  fi
  sleep 1
done

tail -n 100 "$RUNNER_TEMP/rpg-invitation-edge.log" >&2
echo "Local award-coins Edge Function did not become ready." >&2
exit 1
