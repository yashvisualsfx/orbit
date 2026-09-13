# Stops the running Orbit agent.
#
# The agent records its own PID in %LOCALAPPDATA%\Orbit\agent.pid, which is the
# only reliable handle on it: when started with a relative path its command line
# is just "node src/index.js", so searching command lines for "orbit" or for the
# install folder silently matches nothing.

$ErrorActionPreference = 'SilentlyContinue'

$lock = Join-Path $env:LOCALAPPDATA 'Orbit\agent.pid'

if (-not (Test-Path -LiteralPath $lock)) {
    Write-Host '  Orbit was not running.'
    return
}

$recorded = (Get-Content -LiteralPath $lock -Raw).Trim()

if ($recorded -match '^\d+$') {
    $proc = Get-Process -Id ([int]$recorded) -ErrorAction SilentlyContinue
    # Confirm it is still node before killing: PIDs get reused.
    if ($proc -and $proc.ProcessName -eq 'node') {
        Stop-Process -Id ([int]$recorded) -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped the agent (pid $recorded)."
    }
    else {
        Write-Host '  Orbit was not running.'
    }
}

Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
