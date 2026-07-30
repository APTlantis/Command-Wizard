# CommandWizard Tauri Rebuild Proposal

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

CommandWizard needs to be cross-platform, easier to evolve, and better suited to dense command-building workflows than the original Windows-only implementation.

## Mission

Maintain CommandWizard as a local-first Tauri, React, TypeScript, Tailwind, and Rust desktop app that preserves schema-driven command construction while making schema import and review substantially stronger.

## Design Boundaries

In scope:

- Build and copy command strings from local TOML schemas.
- Edit, save, delete, validate, and preview schemas.
- Preserve compatible schema and favorites storage.
- Import schemas from pasted help text, captured help output, and completion data through a reviewable draft workbench.
- Use Blue Slate as the active visual system.
- Bundle Prism Okaidia locally for TOML highlighting.

Out of scope:

- Executing generated commands.
- Cloud sync, accounts, telemetry, or hosted storage.
- Reintroducing PATH modification in the first Tauri release.

## Success Criteria

- [ ] Tauri app launches on the development machine.
- [ ] Existing `schemas/*.toml` and app-data schemas load without manual migration.
- [ ] Builder produces correct command strings for space, equals, and attached argument values.
- [ ] Import Workbench stages actions, arguments, parameters, warnings, and optional completion data before saving.
- [ ] Favorites can be saved, searched, filtered by tag, copied, cleared, and exported.
- [ ] Blue Slate visual-system adoption is visible and documented.
- [ ] Vitest, Rust tests, Playwright smoke tests, and Tauri build pass before any DRS release claim.

## Failure Criteria

- [ ] Generated commands are executed by the app.
- [ ] Existing schema files require undocumented manual conversion.
- [ ] The app depends on network access for normal operation.
- [ ] Documentation claims release verification before the Tauri package is tested.

## Constraints

- Technical: Tauri v2, React, TypeScript, Tailwind v4, local Rust commands for filesystem/process boundaries.
- Scope: first release targets strong parity plus Import Workbench depth.
- Runtime: cross-platform desktop; Windows preserves `%LOCALAPPDATA%\Aptlantis\CommandWizard\`.
- Data: TOML schemas and JSON favorites remain local-first and human-readable.

## Risks

- Risk: Rewriting the help parser may regress edge cases.
  Mitigation: Keep behavioral coverage in Vitest, Rust tests, and Playwright smoke tests.

- Risk: Tauri packaging differs from the prior Windows-only release flow.
  Mitigation: Require a new DRS release evidence bundle before release verification claims.

- Risk: Browser-style UI could become too spacious for an operational command tool.
  Mitigation: Use Blue Slate Workflow Rail, Split Console, Evidence Grid, and compact controls.

## Roadmap

1. Maintain the Tauri/React implementation in-place.
2. Continue strengthening schema, command builder, help import, favorites, and storage behavior.
3. Build out Blue Slate product surfaces.
4. Verify tests, local launch, and packaged behavior.
5. Prepare a Tauri-specific DRS release note and evidence bundle.
