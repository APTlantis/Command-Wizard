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

Governance metadata was reconciled on 2026-07-08: version `1.0.0`, lifecycle `paused`, stage `production`. Evidence reviewed: README.md, tests, packaged release evidence, and legacy manifest. The build, tests, shipping artifact, and release posture were not executed during this metadata pass, so this classification is not a release-readiness claim.

## Structure and relationships

This is registered as one independently governed project.

Legacy manifests, when listed in `CommandWizard.manifest.toml`, are retained as migration evidence rather than parallel authority.

## Build and verification

Verified 2026-07-12 against the v1.0.0 release artifact.

```powershell
# Build
dotnet build .\CommandWizard.csproj -c Release

# Test (11/11 pass)
dotnet test .\CommandWizard.Tests\CommandWizard.Tests.csproj -c Release

# Package MSIX
.\scripts\package-msix.ps1

# Verify signature
Get-AuthenticodeSignature .\dist\CommandWizard-1.0.0.0.msix

# Install
Add-AppxPackage .\dist\CommandWizard-1.0.0.0.msix
```

Evidence bundle: `release-evidence/v1.0.0/` (filehash.txt, build.log, test.log, install-check.txt).

## Known gaps and next review

- Lifecycle state is `paused`; confirm with Herb whether to move to `active` or `archived`.
- Legacy manifest fields reconciled into canonical manifest on 2026-07-08; legacy copies retained as migration evidence.
