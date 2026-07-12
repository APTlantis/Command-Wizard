# CommandWizard

## Purpose and boundaries

WinUI/.NET desktop application for constructing and managing command workflows.

This document is the internal governance and handoff entry point. Existing `README.md`, process documents, source, tests, and built artifacts remain project evidence and should be consulted for operational detail.

## Governance

- [Project manifest](CommandWizard.manifest.toml)
- [Modification instructions](AGENTS.md)
- [DRS canonical standard](D:/.library/aptlantis_core/DRS/README.md)
- [Workspace Governance Standard](D:/.library/aptlantis_core/WGS/README.md)

## Current state

Governance metadata was reconciled on 2026-07-08 and the release posture was re-verified on 2026-07-12: version `1.0.5`, lifecycle `paused`, stage `production`. The `v1.0.0.0` MSIX previously referenced here was found to be a stale build (packaged before the light-theme switch, missing the Delete Schema button and the Arguments grid's Value Style column) and has been superseded by `v1.0.5.0`, built and packaged from current source with a clean build, full test pass, and a verified install/uninstall cycle.

## Structure and relationships

This is registered as one independently governed project.

Legacy manifests, when listed in `CommandWizard.manifest.toml`, are retained as migration evidence rather than parallel authority.

## Build and verification

Verified 2026-07-12 against the v1.0.5 release artifact.

```powershell
# Build
dotnet build .\CommandWizard.csproj -c Release

# Test (26/26 pass)
dotnet test .\CommandWizard.Tests\CommandWizard.Tests.csproj -c Release

# Package + sign MSIX
.\scripts\package-msix.ps1

# Verify signature
Get-AuthenticodeSignature .\dist\CommandWizard-1.0.5.0.msix

# Install
Add-AppxPackage .\dist\CommandWizard-1.0.5.0.msix
```

Evidence bundle: `release-evidence/v1.0.5/` (filehash.txt, build.log, test.log, install-check.txt).

## Known gaps and next review

- Lifecycle state is `paused`; confirm with Herb whether to move to `active` or `archived`.
- Legacy manifest fields reconciled into canonical manifest on 2026-07-08; legacy copies retained as migration evidence.
- `scripts\package-msix.ps1` no longer uses `winapp package`/`winapp sign` (both v0.3.2 and v0.4.0 hit an internal bug that mislabels real `makeappx`/`signtool` errors as a missing-SDK-Build-Tools error); it now invokes `makeappx.exe`/`signtool.exe` directly from the cached `Microsoft.Windows.SDK.BuildTools` NuGet package. Worth reporting upstream to the `winapp` CLI project. See `release-evidence/v1.0.5/install-check.txt`.
