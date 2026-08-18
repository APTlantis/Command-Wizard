# CommandWizard

![status](https://img.shields.io/badge/status-stable%20local%20release-green)
![license](https://img.shields.io/badge/license-MIT-blue)
![language](https://img.shields.io/badge/language-TypeScript%20%2F%20Rust-lightgrey)

CommandWizard is a local-first desktop app for building CLI command strings from TOML schemas. The canonical implementation is now Tauri v2, React, TypeScript, Tailwind v4, and Rust.

Generated commands are copy/export only. CommandWizard does not run generated commands.

Quick links: [Project README](Project-README.md) | [Proposal](Project-Proposal.md) | [Manifest](CommandWizard.manifest.toml)

## Current Release

Current version: **CommandWizard v2.0.0**.

The v2.0.0 stable release is locally verified for Windows x64. The canonical private release artifact is `artifacts/installer/CommandWizard-2.0.0.0-win-x64.exe`, with release notes in `docs/CommandWizard v2.0.0 - Stable Command Workspace Release.md`.

## Product surfaces

| Area | Summary |
|------|---------|
| Builder | Select a tool schema, configure actions, options, and parameters, then copy or favorite the generated command |
| Import Workbench | Capture or paste help text, review detected actions/arguments/parameters/warnings, optionally merge completion data, then save |
| CLI Import | Import a local script into a managed command directory, capture its help text, parse a schema, and save the reviewed command surface |
| Schema Studio | Edit metadata, actions, arguments, parameters, tags, notes, value styles, and highlighted TOML preview |
| Command Library | Search, tag-filter, copy, remove, clear, and export favorite commands |
| Settings / Evidence | Show the data root, Blue Slate adoption, safety boundary, schema/favorite counts, runtime label, and logs |

## Repository layout

```text
src/                          React/TypeScript app
src-tauri/                    Rust command layer, app config, native tests
public/vendor/prism/          Bundled Prism Okaidia assets for TOML highlighting
schemas/                      Starter TOML schemas
tests/                        Playwright smoke tests
scripts/playwright-smoke.ps1  Preview-server smoke helper
Project-Proposal.md           PPS proposal for the rebuild
Project-README.md             Governance and handoff entry point
CommandWizard.manifest.toml   Machine-readable project manifest
```

## Development

```powershell
npm install
npm run dev
npm run build
npm run test
npm run test:rust
npm run test:ui
npm run tauri:dev
npm run tauri:build
```

## Data model

Schemas remain plain TOML:

```toml
[tool]
name = "rsync"
description = "Fast file synchronization tool"

[[arguments]]
flag = "-a"
long = "--archive"
description = "archive mode"
type = "boolean"
value_style = "space"
```

User data is local:

| Artifact | Purpose |
|----------|---------|
| `schemas/*.toml` | One schema per command-line tool |
| `bin/*` | Managed launcher shims for imported CLI scripts; add this directory to PATH manually |
| `cli/scripts/*` | Managed copies of imported script files |
| `history.json` | Saved favorite commands |
| `logs/commandwizard.log` | Local runtime log |

On Windows, the app preserves the existing logical data path under `%LOCALAPPDATA%\Aptlantis\CommandWizard\`. On macOS and Linux, Tauri resolves the platform app data folder and uses the same `Aptlantis/CommandWizard` layout.

## Safety boundaries

- Generated commands are never executed.
- Help capture and completion probing are explicit import probes only.
- CLI import creates launcher shims in a managed local `bin` directory, but does not edit PATH automatically.
- Browser preview cannot run local command capture; paste help text there instead.
- Destructive operations, such as deleting a schema or clearing favorites, require confirmation.
- No cloud sync, accounts, telemetry, or automatic PATH modification are included.

## Verification

Current checks:

```powershell
npm run build
npm run test
npm run test:rust
npm run test:ui
```

The v2.0.0 Tauri app is local-verified under DRS. Full installer install/uninstall was not executed during this local verification pass; launch behavior was verified from the packaged release executable.

## Core principles

**Local-first**  
Schemas, favorites, and logs stay on the user's machine.

**Schema-driven**  
Command structure is described in TOML, so adding a tool is a data change rather than a code change.

**Review before save**  
The Import Workbench stages detected rows and warnings before writing a schema.

**Cross-platform desktop**  
Tauri owns the local filesystem and process boundary; React owns the workflow UI.

## License

MIT License.

## Author

Maintained by Herb.
