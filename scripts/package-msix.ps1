param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$Version = "1.0.1.0",
    [string]$Certificate = ".\devcert.pfx",
    [string]$CertificatePassword = "password"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$publishDir = Join-Path $repoRoot "dist\v1.0.1\$Runtime\publish"
$packagePath = Join-Path $repoRoot "dist\CommandWizard-$Version.msix"
$manifestPath = Join-Path $repoRoot "appxmanifest.xml"
$projectPath = Join-Path $repoRoot "CommandWizard.csproj"
$certPath = Join-Path $repoRoot $Certificate

if (-not (Test-Path $certPath)) {
    throw "Signing certificate not found: $certPath"
}

if (Test-Path $publishDir) {
    Remove-Item -LiteralPath $publishDir -Recurse -Force
}

New-Item -ItemType Directory -Path $publishDir | Out-Null

dotnet publish $projectPath `
    -c $Configuration `
    -r $Runtime `
    --self-contained true `
    /p:WindowsAppSDKSelfContained=true `
    -o $publishDir

if (Test-Path $packagePath) {
    Remove-Item -LiteralPath $packagePath -Force
}

winapp package $publishDir `
    --manifest $manifestPath `
    --cert $certPath `
    --cert-password $CertificatePassword `
    --exe CommandWizard.exe `
    --output $packagePath

if (-not (Test-Path $packagePath)) {
    throw "MSIX package was not created: $packagePath"
}

Write-Host "Created $packagePath"
