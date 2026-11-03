$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$verify = Join-Path $repoRoot 'scripts/verify-migration-inventory.ps1'
$result = & $verify
if ($result.inventoryValidation -ne 'passed' -or $result.bootstrapReady -or $result.databaseTestsExecuted) { throw 'Inventory audit misrepresented bootstrap/database status' }
Write-Output 'PASS: inventory and local Git provenance agree; bootstrap remains blocked'
try { & $verify -RequireBootstrap; throw 'Unexpected bootstrap approval' }
catch { if ($_.Exception.Message -notlike 'Historical bootstrap is blocked:*') { throw }; Write-Output 'PASS: missing history blocks a full bootstrap gate' }
$inventory = Get-Content -Raw -Encoding UTF8 (Join-Path $repoRoot 'docs/migration-inventory.json') | ConvertFrom-Json
$inventory.migrations = @($inventory.migrations) + $inventory.migrations[0]
$testDirectory = Join-Path $repoRoot '.runtime/inventory-tests'
New-Item -ItemType Directory -Force -Path $testDirectory | Out-Null
$duplicatePath = Join-Path $testDirectory 'duplicate.json'
$inventory | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -LiteralPath $duplicatePath
try { & $verify -ManifestPath $duplicatePath; throw 'Unexpected duplicate approval' }
catch { if ($_.Exception.Message -ne 'Duplicate migration version in inventory') { throw }; Write-Output 'PASS: duplicate historical versions are rejected' }
