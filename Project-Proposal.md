# CommandWizard Tauri Rebuild Proposal

## Project Type

Desktop application.

## Readiness Level

ready

---

## Governing Standards

* Proposal: PPS (`D:\.library\aptlantis_core\PPS\README.md`)
* Workspace: WGS (`D:\.library\aptlantis_core\WGS\README.md`)
* Delivery: DRS (`D:\.library\aptlantis_core\DRS\README.md`)
* Supporting: Blue Slate (`D:\.library\aptlantis_core\blue.slate\README.md`)

---

## Problem Statement

CommandWizard has evolved beyond a Windows-only command wizard. The original WPF implementation proved the schema model but became increasingly difficult to extend, visually dense without clear hierarchy, and tightly coupled to Windows.

The Tauri rebuild modernizes the application into a local-first command workspace that can discover, normalize, document, build, validate, and eventually execute command-line interfaces while preserving the structured schema-driven architecture established by the original project.

---

## Mission

Maintain CommandWizard as a local-first Tauri, React, TypeScript, Tailwind, and Rust desktop application that provides a complete lifecycle for command-line tools.

The application treats every CLI as structured data, allowing operators to import, review, edit, validate, organize, and build commands through durable TOML schemas while remaining entirely local-first.

---

## Product Workflow

```text
Discover CLI
      ↓
Capture Help / Completion Data
      ↓
Review & Normalize
      ↓
Schema Authoring
      ↓
Command Builder
      ↓
Favorites / Library
      ↓
Dry Run (planned)
      ↓
ConPTY Execution (planned)
      ↓
Evidence & Logs
```

---

## Primary Workspaces

### Builder

Construct commands from validated schemas using structured controls rather than manually typing command lines.

Features include:

* Action selection
* Parameter editing
* Flag selection
* Live command preview
* Validation status
* Copy and save operations

---

### Import Workbench

Convert command help output into reviewable draft schemas.

Supports:

* pasted help text
* captured `--help`
* completion metadata
* staged review before saving
* warning generation
* editable normalization

---

### CLI Import

Register managed local executables as first-class CommandWizard tools.

Supports:

* executable discovery
* launcher generation
* managed script catalog
* PATH staging directory
* provenance of imported tools

---

### Schema Studio

Maintain canonical TOML command definitions.

Supports:

* visual editing
* synchronized TOML preview
* Prism syntax highlighting
* validation
* action management
* argument editing
* schema persistence

---

### Library

Maintain reusable command tasks and operator favorites.

Supports:

* reusable saved commands
* tagging
* search
* export
* copy
* organization

---

### Evidence

Provide operational transparency for the application.

Includes:

* runtime configuration
* activity log
* imported tools
* schema history
* safety state
* visual system status
* release evidence

---

## Design Boundaries

### In Scope

* Local-first command management.
* TOML schema authoring.
* Schema validation.
* Command construction.
* Reviewable import pipeline.
* CLI registration and launcher generation.
* Favorites and reusable command library.
* Evidence logging.
* Blue Slate visual system.
* Shared Aptlantis design components.
* Shared syntax highlighting infrastructure.

### Future Scope

* Integrated ConPTY terminal.
* Native dry-run workflow.
* Execution transcript capture.
* Exit-code reporting.
* Execution duration.
* Optional execution evidence.
* Native tool dry-run support where available.

### Out of Scope (Current Release)

* Cloud synchronization.
* User accounts.
* Telemetry.
* Hosted storage.
* Automatic remote schema repositories.

---

## Success Criteria

* [ ] Existing TOML schemas load without migration.
* [ ] Import Workbench successfully stages draft schemas before persistence.
* [ ] CLI Import registers managed executables and generates launchers.
* [ ] Builder generates valid commands for supported argument styles.
* [ ] Schema Studio maintains synchronized visual and TOML editing.
* [ ] Favorites and Library remain local-first.
* [ ] Evidence accurately records application activity.
* [ ] Blue Slate visual language is consistently applied.
* [ ] Shared syntax highlighting matches Structra.
* [ ] Cross-platform builds complete successfully.
* [ ] DRS release evidence produced before release claims.

---

## Failure Criteria

* [ ] Schema corruption during import.
* [ ] Existing schemas require undocumented migration.
* [ ] Network dependency for normal operation.
* [ ] Loss of local-first behavior.
* [ ] Release verification claimed before packaged validation.
* [ ] Execution enabled without explicit operator intent.

---

## Constraints

### Technical

* Tauri v2
* React
* TypeScript
* Tailwind v4
* Rust backend
* Local TOML schemas
* Local JSON favorites
* ConPTY integration (planned)

### Runtime

Cross-platform desktop application with Windows preserving:

```
%LOCALAPPDATA%\Aptlantis\CommandWizard\
```

### Data

Human-readable local storage.

* TOML schemas
* JSON favorites
* evidence logs
* managed launcher metadata

---

## Risks

### Help Parsing

CLI help remains inconsistent.

**Mitigation**

Continue parser improvements, staged review, completion import, and editable normalization.

---

### Cross-platform Packaging

Packaging differs from the previous Windows implementation.

**Mitigation**

Continue producing DRS release evidence before release verification.

---

### Dense Operational UI

CommandWizard intentionally exposes large amounts of structured information.

**Mitigation**

Continue using Blue Slate workflow patterns:

* Workflow Rail
* Split Console
* Evidence Grid
* persistent Preview Rail
* compact editing controls

---

### Future Execution

Executing commands introduces greater responsibility than building commands.

**Mitigation**

Execution will remain an explicit operator action.

Planned execution pipeline:

```
Build
   ↓
Dry Run
   ↓
Operator Review
   ↓
ConPTY Execution
   ↓
Evidence Capture
```

---

## Roadmap

1. Complete UI stabilization and layout refinement.
2. Finish Builder, Import, CLI Import, Schema, Library, and Evidence workflows.
3. Share syntax-highlighting infrastructure with Structra.
4. Expand managed CLI launcher support.
5. Introduce integrated ConPTY terminal.
6. Implement dry-run validation pipeline.
7. Capture execution evidence and transcripts.
8. Verify cross-platform packaging.
9. Produce Tauri DRS release evidence.
10. Release CommandWizard v2.
