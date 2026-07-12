param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$Version = "1.0.5.0",
    [string]$Certificate = ".\devcert.pfx",
    [string]$CertificatePassword = "password"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$publishDir = Join-Path $repoRoot "dist\v1.0.5\$Runtime\publish"
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

# NOTE: `winapp package` / `winapp sign` (CLI v0.3.2 and v0.4.0) both fail on
# this project with a misleading "Could not install or find Windows SDK Build
# Tools" error, regardless of the real cause. Packaging is done directly with
# makeappx.exe / signtool.exe from the cached Microsoft.Windows.SDK.BuildTools
# NuGet package instead. See release-evidence/v1.0.5/install-check.txt.

$buildToolsRoot = Join-Path $env:USERPROFILE ".nuget\packages\microsoft.windows.sdk.buildtools"
if (-not (Test-Path $buildToolsRoot)) {
    throw "Microsoft.Windows.SDK.BuildTools not found in NuGet cache: $buildToolsRoot. Build the project first to restore it."
}

$sdkVersionDir = Get-ChildItem $buildToolsRoot -Directory |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1

$toolsBin = Get-ChildItem (Join-Path $sdkVersionDir.FullName "bin") -Directory |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1

$makeappx = Join-Path $toolsBin.FullName "x64\makeappx.exe"
$signtool = Join-Path $toolsBin.FullName "x64\signtool.exe"

if (-not (Test-Path $makeappx)) { throw "makeappx.exe not found: $makeappx" }
if (-not (Test-Path $signtool)) { throw "signtool.exe not found: $signtool" }

$stagingDir = Join-Path $env:TEMP "commandwizard-msix-staging"
if (Test-Path $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Copy-Item -Path (Join-Path $publishDir "*") -Destination $stagingDir -Recurse
Copy-Item -Path $manifestPath -Destination (Join-Path $stagingDir "AppxManifest.xml")

& $makeappx pack /d $stagingDir /p $packagePath /o
if ($LASTEXITCODE -ne 0) {
    throw "makeappx failed with exit code $LASTEXITCODE"
}

& $signtool sign /fd SHA256 /a /f $certPath /p $CertificatePassword $packagePath
if ($LASTEXITCODE -ne 0) {
    throw "signtool failed with exit code $LASTEXITCODE"
}

Remove-Item -LiteralPath $stagingDir -Recurse -Force

if (-not (Test-Path $packagePath)) {
    throw "MSIX package was not created: $packagePath"
}

Write-Host "Created and signed $packagePath"
