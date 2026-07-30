# CommandWizard

## Purpose and boundaries

Local-first desktop application for constructing and managing command workflows. The verified production artifact is the original WPF/.NET app; active v2 rebuild work is now in-place using Tauri, React, TypeScript, and Tailwind.

This document is the internal governance and handoff entry point. Existing `README.md`, process documents, source, tests, and built artifacts remain project evidence and should be consulted for operational detail.

## Governance

- [Project manifest](CommandWizard.manifest.toml)
- [v2 rebuild proposal](Project-Proposal.md)
- [Modification instructions](AGENTS.md)
- [DRS canonical standard](D:/.library/aptlantis_core/DRS/README.md)
- [Workspace Governance Standard](D:/.library/aptlantis_core/WGS/README.md)
- [Blue Slate visual system](D:/.library/aptlantis_core/blue.slate/README.md)

## Current state

Governance metadata was reconciled on 2026-07-08 and the WPF release posture was re-verified on 2026-07-12: version `1.0.5`, lifecycle `paused`, stage `production`. The `v1.0.0.0` MSIX previously referenced here was found to be a stale build (packaged before the light-theme switch, missing the Delete Schema button and the Arguments grid's Value Style column) and has been superseded by `v1.0.5.0`, built and packaged from current source with a clean build, full test pass, and a verified install/uninstall cycle.

As of 2026-07-30, CommandWizard has an in-place Tauri v2 rebuild scaffold. This is active implementation work, not a DRS release claim. The WPF source, packaged artifact, release evidence, and legacy documentation remain preserved until migration review.

## Visual system

CommandWizard v2 adopts [Blue Slate](D:/.library/aptlantis_core/blue.slate/Project-README.md) as an active visual-system dependency for color tokens, operational layout, command surfaces, status chips, evidence panels, and focus treatment.

## Structure and relationships

This is registered as one independently governed project.

Legacy manifests, when listed in `CommandWizard.manifest.toml`, are retained as migration evidence rather than parallel authority.

## Build and verification

Verified 2026-07-12 against the WPF v1.0.5 release artifact.

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

Tauri v2 development commands:

```powershell
npm run dev
npm run build
npm run test
npm run test:rust
npm run test:ui
npm run tauri:dev
npm run tauri:build
```

These commands must pass and be captured in a new evidence bundle before the Tauri implementation is described as release-verified.

## Known gaps and next review

- Lifecycle state is `paused`; confirm with Herb whether to move to `active` or `archived`.
- Reconcile lifecycle now that active Tauri v2 rebuild work exists while WPF v1.0.5 remains the verified artifact.
- Complete Tauri dependency install, build, tests, launch, and package verification.
- Legacy manifest fields reconciled into canonical manifest on 2026-07-08; legacy copies retained as migration evidence.
- `scripts\package-msix.ps1` no longer uses `winapp package`/`winapp sign` (both v0.3.2 and v0.4.0 hit an internal bug that mislabels real `makeappx`/`signtool` errors as a missing-SDK-Build-Tools error); it now invokes `makeappx.exe`/`signtool.exe` directly from the cached `Microsoft.Windows.SDK.BuildTools` NuGet package. Worth reporting upstream to the `winapp` CLI project. See `release-evidence/v1.0.5/install-check.txt`.
