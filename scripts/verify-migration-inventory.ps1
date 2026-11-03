param([string]$ManifestPath = '', [switch]$RequireBootstrap)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!$ManifestPath) { $ManifestPath = Join-Path (Join-Path $repoRoot 'docs') 'migration-inventory.json' }
$inventory = Get-Content -Raw -Encoding UTF8 -LiteralPath $ManifestPath | ConvertFrom-Json
$rows = @($inventory.migrations)
if (@($rows | Group-Object version | Where-Object Count -gt 1).Count) { throw 'Duplicate migration version in inventory' }
$tracked = @($rows | Where-Object status -ne 'missing_historical_sql')
$missing = @($rows | Where-Object status -eq 'missing_historical_sql')
foreach ($row in $rows) {
    if ($row.version -notmatch '^\d{14}$' -or $row.name -notmatch '^[a-z0-9_]+$') { throw 'Invalid migration identity' }
    if ($row.status -notin @('missing_historical_sql','tracked_recorded_applied','not_in_recorded_applied_snapshot')) { throw 'Invalid inventory status' }
    if ($row.status -eq 'missing_historical_sql') {
        if ($row.path -or $row.git_blob_sha1) { throw 'Missing historical SQL cannot have fabricated file provenance' }
        continue
    }
    $expectedPath = 'supabase/migrations/' + $row.version + '_' + $row.name + '.sql'
    if ($row.path -ne $expectedPath) { throw 'Migration path does not match its identity' }
    $fullPath = Join-Path $repoRoot $expectedPath
    if (!(Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Tracked migration is missing: $expectedPath" }
    $blob = & git -C $repoRoot rev-parse ('HEAD:' + $expectedPath)
    if ($LASTEXITCODE -ne 0 -or $blob -ne $row.git_blob_sha1) { throw "Migration provenance mismatch: $expectedPath" }
    & git -C $repoRoot diff --quiet HEAD -- $expectedPath
    if ($LASTEXITCODE -ne 0) { throw "Migration changed since recorded provenance: $expectedPath" }
}
$actual = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'supabase/migrations') -Filter '*.sql' -File)
if ($actual.Count -ne $tracked.Count) { throw 'Runner directory contains unrecorded migrations' }
$recordedApplied = @($rows | Where-Object status -in @('missing_historical_sql','tracked_recorded_applied'))
if ($recordedApplied.Count -ne $inventory.recorded_snapshot.applied_versions) { throw 'Recorded applied version count is inconsistent' }
if ($inventory.bootstrap_ready -and $missing.Count) { throw 'Cannot declare bootstrap ready with missing historical SQL' }
if ($RequireBootstrap -and (!$inventory.bootstrap_ready -or $missing.Count -or $inventory.current_metadata.status -ne 'verified')) {
    throw "Historical bootstrap is blocked: $($missing.Count) missing SQL files; current metadata is not verified"
}
[PSCustomObject]@{
    inventoryValidation = 'passed'
    recordedApplied = $recordedApplied.Count
    localSqlFiles = $tracked.Count
    missingHistoricalSql = $missing.Count
    notInRecordedSnapshot = @($rows | Where-Object status -eq 'not_in_recorded_applied_snapshot').Count
    bootstrapReady = $false
    databaseTestsExecuted = $false
    currentProductionVerified = $false
}
