# CommandWizard

## Purpose and boundaries

CommandWizard is a local-first Tauri desktop app for constructing and managing command workflows from TOML schemas. The canonical implementation is now React, TypeScript, Tailwind v4, Tauri v2, and Rust.

The app builds command strings for copy/export workflows. It does not execute generated commands.

CLI import can copy a user-selected script into CommandWizard's managed local data area and create a launcher shim in the app's `bin` directory. Users add that directory to PATH themselves; CommandWizard does not edit PATH automatically.

## Governance

- [Project manifest](CommandWizard.manifest.toml)
- [Rebuild proposal](Project-Proposal.md)
- [Modification instructions](AGENTS.md)
- [DRS canonical standard](D:/.library/aptlantis_core/DRS/README.md)
- [Workspace Governance Standard](D:/.library/aptlantis_core/WGS/README.md)
- [Blue Slate visual system](D:/.library/aptlantis_core/blue.slate/README.md)

## Current state

As of 2026-07-30, previous implementation files, old test projects, old packaging assets, project images, and old release evidence have been removed from this working project after backup confirmation from Herb.

The active project contains the Tauri rebuild, current schemas, PPS/DRS/WGS documentation, manifest metadata, bundled Prism Okaidia TOML highlighting assets, and current test suites.

## Visual system

CommandWizard adopts [Blue Slate](D:/.library/aptlantis_core/blue.slate/Project-README.md) as an active visual-system dependency for color tokens, operational layout, command surfaces, status chips, evidence panels, and focus treatment.

## Build and verification

Development and verification commands:

```powershell
npm run dev
npm run build
npm run test
npm run test:rust
npm run test:ui
npm run tauri:dev
npm run tauri:build
```

Release verification still requires a DRS evidence bundle from a clean build, tests, launch verification, and packaged app verification.

## Known gaps and next review

- Complete a Tauri release evidence bundle before calling the app release-verified.
- Expand Import Workbench coverage as the parser handles more command families.
- Confirm cross-platform data path behavior on macOS and Linux.
- Decide whether to keep generated Vite `dist/` artifacts checked in after release packaging policy is finalized.
