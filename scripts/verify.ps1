# scripts/verify.ps1
#
# Runs the same checks as CI (.github/workflows/ci.yml) locally.
# Use before pushing a branch to catch build errors before they reach GitHub.
#
# Usage:  pwsh -File scripts/verify.ps1
#         (or run from repo root)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $repoRoot 'server'
$clientDir = Join-Path $repoRoot 'client'

function Section($label) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " $label" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

$overallStart = Get-Date
$failures = @()

# --- Server ---
Section "SERVER: prisma generate"
Push-Location $serverDir
try {
    npx prisma generate
    if ($LASTEXITCODE -ne 0) { $failures += 'server: prisma generate' }
} finally {
    Pop-Location
}

Section "SERVER: tsc build"
Push-Location $serverDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { $failures += 'server: build' }
} finally {
    Pop-Location
}

# --- Client ---
Section "CLIENT: next build"
Push-Location $clientDir
try {
    $env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api'
    npm run build
    if ($LASTEXITCODE -ne 0) { $failures += 'client: build' }
} finally {
    Pop-Location
}

# --- Summary ---
$elapsed = (Get-Date) - $overallStart
Section "SUMMARY"
Write-Host ("Elapsed: {0:mm}m {0:ss}s" -f $elapsed)
if ($failures.Count -eq 0) {
    Write-Host "All checks passed. Safe to push." -ForegroundColor Green
    exit 0
} else {
    Write-Host "FAILURES:" -ForegroundColor Red
    foreach ($f in $failures) { Write-Host " - $f" -ForegroundColor Red }
    exit 1
}
