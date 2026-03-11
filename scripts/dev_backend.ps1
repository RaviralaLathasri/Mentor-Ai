param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

Write-Host "Starting Mentor AI backend (clean logs) on http://127.0.0.1:$Port ..." -ForegroundColor Cyan

# Ensure we run from repo root even if invoked from elsewhere
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$env:PORT = "$Port"
$env:UVICORN_RELOAD = "1"
$env:UVICORN_ACCESS_LOG = "0"

& .\venv\Scripts\python -m app.devserver

