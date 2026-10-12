# CommandWizard

## Purpose and boundaries

CommandWizard is a local-first Tauri desktop app for constructing and managing command workflows from TOML schemas. The canonical implementation is now React, TypeScript, Tailwind v4, Tauri v2, and Rust.

The app builds command strings for copy/export workflows. It does not execute generated commands.

CLI import can copy a user-selected script into CommandWizard's managed local data area and create a launcher shim in the app's `bin` directory. Users add that directory to PATH themselves; CommandWizard does not edit PATH automatically.

## Governance

- [Project manifest](CommandWizard.manifest.toml)
- [Rebuild proposal](Project-Proposal.md)
- [Modification instructions](AGENTS.md)
- [DRS canonical standard](D:/.city_hall/DRS/README.md)
- [Workspace Governance Standard](D:/.city_hall/WGS/README.md)
- [Blue Slate visual system](D:/.city_hall/blue.slate/README.md)

## Current state

### Command category maintenance — 2026-10-12

Builder now contains General, PowerShell, and Linux (WSL) tabs. PowerShell is for cmdlets such as `Move-Item` and `Invoke-WebRequest`, not every executable run from a PowerShell session. Common Linux utilities and schemas tagged `linux` or `wsl` are grouped in Linux; other applications default to General. Use **Schema → Command Category → Save Schema** to explicitly assign an installed application to a tab. This choice survives desktop reloads through a reserved `workspace:general`, `workspace:powershell`, or `workspace:linux` schema tag; existing user tags are preserved.

Command Preview appears only in Builder with a selected command. Parameters appear above Options in two columns, with an odd final parameter spanning both columns. Empty parameter sections are hidden. CLI navigation is hidden while its implementation and stored data remain available for a future removal decision. The generic Not ready and Needs Review badges are removed from the preview and tool rail; specific validation details remain in the preview. Native Windows executable checks do not establish PowerShell cmdlet or Linux/WSL availability.

See [maintenance verification](docs/Command-Categories-2026-10-12.md) for current checks and artifact limits. The existing v2.0.0 release record below remains historical; these source changes do not overwrite that installer or its recorded hash.

As of 2026-07-30, previous implementation files, old test projects, old packaging assets, project images, and old release evidence have been removed from this working project after backup confirmation from Herb.

The active project contains the Tauri rebuild, current schemas, PPS/DRS/WGS documentation, manifest metadata, bundled Prism Okaidia TOML highlighting assets, and current test suites.

As of 2026-07-31, version `2.0.0` is the local-verified stable release. The canonical private release artifact is `artifacts/installer/CommandWizard-2.0.0.0-win-x64.exe`. Future manifest-import expansion and parser improvements are maintenance patch/minor work, not blockers for the current stable release.

## Visual system

CommandWizard adopts [Blue Slate](D:/.city_hall/blue.slate/Project-README.md) as an active visual-system dependency for color tokens, operational layout, command surfaces, status chips, evidence panels, and focus treatment.

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

The v2.0.0 stable release was verified with build, tests, UI smoke, Tauri packaging, SHA-256 hashing, unsigned Authenticode status, and launch verification from the packaged release executable. Full installer install/uninstall was not executed during this local verification pass.

## Known gaps and next review

- Expand Import Workbench coverage as the parser handles more command families.
- Confirm cross-platform data path behavior on macOS and Linux.
- Decide whether to keep generated Vite `dist/` artifacts checked in after release packaging policy is finalized.
