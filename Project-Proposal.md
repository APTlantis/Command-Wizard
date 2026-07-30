# CommandWizard v2 Tauri Rebuild Proposal

## Project Type

Desktop application.

## Readiness Level

ready

## Governing Standards

- Proposal: PPS (`D:\.library\aptlantis_core\PPS\README.md`)
- Workspace: WGS (`D:\.library\aptlantis_core\WGS\README.md`)
- Delivery: DRS (`D:\.library\aptlantis_core\DRS\README.md`)
- Supporting: Blue Slate (`D:\.library\aptlantis_core\blue.slate\README.md`)

## Problem Statement

CommandWizard is useful, but the original WPF implementation makes the interface hard to evolve and keeps the app Windows-only. The current feature model should become cross-platform, easier to maintain, and better suited to command-building workflows that need dense editing, review, and evidence surfaces.

## Mission

Rebuild CommandWizard as a local-first Tauri, React, TypeScript, and Tailwind desktop app that preserves schema-driven command construction while making schema import and review substantially stronger.

## Design Boundaries

In scope:

- Build and copy command strings from local TOML schemas.
- Edit, save, delete, validate, and preview schemas.
- Preserve compatible schema and favorites storage.
- Import schemas from help text and completion data through a reviewable draft workbench.
- Use Blue Slate as the active visual system.

Out of scope:

- Executing generated commands.
- Cloud sync, accounts, telemetry, or hosted storage.
- Removing WPF source or release evidence before migration review.
- Reintroducing PATH modification in the first Tauri release.

## Success Criteria

- [ ] Tauri app launches on the development machine.
- [ ] Existing `schemas/*.toml` and AppData schemas load without manual migration.
- [ ] Builder produces the same command strings for space, equals, and attached argument values.
- [ ] Import Workbench stages actions, arguments, parameters, warnings, and optional completion data before saving.
- [ ] Favorites can be saved, searched, filtered by tag, copied, cleared, and exported.
- [ ] Blue Slate visual-system adoption is visible and documented.
- [ ] Vitest, Rust tests, Playwright smoke tests, and Tauri build pass before any DRS release claim.

## Failure Criteria

- [ ] Generated commands are executed by the app.
- [ ] Existing WPF release evidence is deleted or overwritten.
- [ ] Existing schema files require undocumented manual conversion.
- [ ] The app depends on network access for normal operation.
- [ ] Documentation claims release verification before the Tauri package is tested.

## Constraints

- Technical: Tauri v2, React, TypeScript, Tailwind v4, local Rust commands for filesystem/process boundaries.
- Scope: first release targets strong v1 parity plus Import Workbench.
- Runtime: cross-platform desktop; Windows preserves `%LOCALAPPDATA%\Aptlantis\CommandWizard\`.
- Data: TOML schemas and JSON favorites remain local-first and human-readable.

## Risks

- Risk: Rewriting the help parser may regress edge cases already covered by the C# tests.
  Mitigation: Port behavioral coverage into Vitest and keep C# tests as baseline evidence.

- Risk: Tauri packaging differs from the prior MSIX release flow and requires release-style numeric version metadata.
  Mitigation: Keep the WPF release claim separate until a new DRS release gate is completed.

- Risk: Browser-style UI could become too spacious for an operational command tool.
  Mitigation: Use Blue Slate Workflow Rail, Split Console, Evidence Grid, and compact controls.

## Roadmap

1. Scaffold Tauri/React implementation in-place.
2. Port schema, command builder, help import, favorites, and storage behavior.
3. Build Blue Slate product surfaces.
4. Verify tests, local launch, and packaged behavior.
5. Prepare a Tauri-specific DRS release note and evidence bundle.
