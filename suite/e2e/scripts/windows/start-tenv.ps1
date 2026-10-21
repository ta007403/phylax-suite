# Imports a trezor-user-env rootfs into WSL and starts it. The process is a child of the calling
# shell: on a GitHub runner it dies with the step, so the tests must run in the same step.
param(
    [Parameter(Mandatory)] [string] $RootfsPath,
    [string] $DistroName = 'trezor-user-env',
    [string] $DistroDir = 'D:\tenv',
    [string] $LogDir = 'tenv-logs',
    [int] $TimeoutSeconds = 240
)

$ErrorActionPreference = 'Stop'
$env:WSL_UTF8 = 1

wsl --import $DistroName $DistroDir $RootfsPath --version 2
if ($LASTEXITCODE -ne 0) { throw "wsl --import failed with exit code $LASTEXITCODE" }
wsl -d $DistroName -- mkdir -p /trezor-user-env/logs/screens

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$outLog = Join-Path $LogDir 'tenv.out.log'
$errLog = Join-Path $LogDir 'tenv.err.log'
# A single string: an argument array is joined without quotes and WSL would receive "uv" alone.
$proc = Start-Process wsl -ArgumentList "-d $DistroName --cd /trezor-user-env -- env PYTHONUNBUFFERED=1 uv run python src/main.py" -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
$env:TENV_PID = $proc.Id

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) {
        Get-Content $outLog, $errLog
        throw "trezor-user-env exited with code $($proc.ExitCode)"
    }
    try {
        if ((Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9002/' -TimeoutSec 3).StatusCode -eq 200) {
            Write-Host "trezor-user-env is reachable on 127.0.0.1:9002 (pid $($proc.Id))"
            return
        }
    } catch {
        # not up yet
    }
    Start-Sleep -Seconds 3
}

Get-Content $outLog, $errLog
wsl -d $DistroName -- netstat -ltnp
throw "trezor-user-env dashboard not reachable on 127.0.0.1:9002 within $TimeoutSeconds s"
