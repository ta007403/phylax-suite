# Runs the Playwright tests against a trezor-user-env started by start-tenv.ps1, then collects its
# logs and shuts WSL down. Orchestrates through Currents when CURRENTS_RECORD_KEY is set.
param(
    [string] $Config = './playwright-config/playwright-desktop-windows.config.ts',
    [string] $DistroName = 'trezor-user-env',
    [string] $LogDir = 'tenv-logs'
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
$testExitCode = 1

try {
    Push-Location $repoRoot
    if ($env:CURRENTS_RECORD_KEY) {
        $discoveryFile = New-TemporaryFile
        yarn workspace @trezor/suite-e2e test:orchestrated:e2e discover --pwc-discovery-file $discoveryFile --config=$Config
        if ($LASTEXITCODE -ne 0) { throw "Currents discovery failed with exit code $LASTEXITCODE" }
        if (Select-String -Path $discoveryFile -Pattern 'Total: 0 tests' -Quiet) {
            Write-Host 'Discovery selected 0 tests, nothing to run.'
            $testExitCode = 0
        } else {
            yarn workspace @trezor/suite-e2e test:orchestrated:e2e run --pwc-discovery-file $discoveryFile --config=$Config --pwc-cancel-after-failures false --pwc-disable-test-tags --pwc-skip-reporter-injection
            $testExitCode = $LASTEXITCODE
        }
    } else {
        yarn workspace @trezor/suite-e2e exec playwright test --config=$Config
        $testExitCode = $LASTEXITCODE
    }
} finally {
    Pop-Location
    Write-Host '::group::Collect trezor-user-env logs'
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    wsl -d $DistroName -- bash -c 'mkdir -p /trezor-user-env/logs; tar -czf /tmp/tenv-logs.tar.gz -C /trezor-user-env logs'
    wsl -d $DistroName -- cat /tmp/tenv-logs.tar.gz > (Join-Path $LogDir 'tenv-internal-logs.tar.gz')
    if ($env:TENV_PID) { Stop-Process -Id $env:TENV_PID -Force -ErrorAction SilentlyContinue }
    wsl --shutdown
    Write-Host '::endgroup::'
}

exit $testExitCode
