$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$npx = (Get-Command npx.cmd -ErrorAction Stop).Source
$vite = Start-Process `
    -FilePath $npx `
    -ArgumentList @("vite", "--host", "127.0.0.1", "--port", "5173", "--strictPort") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

try {
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200) {
                $ready = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $ready) {
        throw "Vite dev server did not become ready."
    }

    & $npx playwright test
    exit $LASTEXITCODE
}
finally {
    if ($vite -and -not $vite.HasExited) {
        Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
    }
}
