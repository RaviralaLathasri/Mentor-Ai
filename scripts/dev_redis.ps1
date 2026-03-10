$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$devDir = Join-Path $repoRoot ".dev"
$redisRoot = Join-Path $devDir "redis"

$version = "5.0.14.1"
$zipName = "Redis-x64-$version.zip"
$zipPath = Join-Path $redisRoot $zipName
$extractDir = Join-Path $redisRoot "Redis-x64-$version"
$serverExe = Join-Path $extractDir "redis-server.exe"

New-Item -ItemType Directory -Force -Path $redisRoot | Out-Null

if (-not (Test-Path $serverExe)) {
  $downloadUrl = "https://github.com/tporadowski/redis/releases/download/v$version/$zipName"
  Write-Host "Downloading Redis for Windows $version..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

  if (Test-Path $extractDir) {
    Remove-Item -Recurse -Force $extractDir
  }

  Write-Host "Extracting..." -ForegroundColor Cyan
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
}

if (-not (Test-Path $serverExe)) {
  throw "redis-server.exe not found after extraction: $serverExe"
}

# Redis must never persist audio. We also disable Redis persistence for safety.
# Use a config file so we can express `save ""` without needing an empty CLI arg.
$confPath = Join-Path $redisRoot "redis-dev.conf"
if (-not (Test-Path $confPath)) {
  @(
    "bind 127.0.0.1",
    "port 6379",
    "protected-mode yes",
    "appendonly no",
    'save ""'
  ) | Set-Content -Path $confPath -Encoding ASCII
}

Write-Host "Starting Redis server on 127.0.0.1:6379 (no persistence)..." -ForegroundColor Cyan
$stdout = Join-Path $redisRoot "redis.out.log"
$stderr = Join-Path $redisRoot "redis.err.log"
$proc = Start-Process -FilePath $serverExe -ArgumentList @($confPath) -WorkingDirectory $extractDir -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru

Start-Sleep -Seconds 1
$ok = $false
try {
  $ok = Test-NetConnection 127.0.0.1 -Port 6379 -InformationLevel Quiet
} catch {
  $ok = $false
}

if (-not $ok) {
  Write-Warning "Redis process started (PID $($proc.Id)) but port 6379 is not reachable yet."
  Write-Warning "If Windows Firewall prompts, allow local access."
} else {
  Write-Host "Redis is running (PID $($proc.Id))." -ForegroundColor Green
}
