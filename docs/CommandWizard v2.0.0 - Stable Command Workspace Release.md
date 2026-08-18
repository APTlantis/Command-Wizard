# CommandWizard v2.0.0 - Stable Command Workspace Release

CommandWizard v2.0.0 is the stable local-first Tauri release of the command workflow builder. It establishes the React, TypeScript, Tailwind, and Rust rebuild as the current production baseline for constructing, importing, reviewing, saving, and exporting command schemas without executing generated commands.

---

## Highlights

### Command Workspace Baseline

The Builder, Import Workbench, CLI Import, Schema Studio, Command Library, and Settings/Evidence surfaces form the stable workflow for schema-driven command construction.

### Local-First Safety Boundary

Generated commands remain copy/export only. Help capture and completion probing are explicit import probes, CLI Import writes managed local shims, and CommandWizard does not edit PATH automatically.

### Verified Tauri Package

The Windows x64 NSIS setup executable was built from the current Tauri v2 source, copied into the DRS artifact path, hashed, checked for signing status, and launch-verified from the packaged release executable.

---

## Design Boundaries

CommandWizard v2.0.0 intentionally does not:

* Execute generated commands.
* Automatically edit PATH.
* Depend on cloud sync, accounts, telemetry, or hosted schema storage.
* Claim macOS or Linux package verification for this local Windows release.

---

## Built With

* Tauri v2
* React and TypeScript
* Tailwind v4
* Rust
* Zustand, Vitest, and Playwright

---

## Release Artifact

Expected installer:

* `CommandWizard-2.0.0.0-win-x64.exe`

SHA-256:

* `6B75295313661A71E0BB14197547A4D377AE5740896B56CA9205CF4CE002CA64`

Signing status: unsigned; `Get-AuthenticodeSignature` reported `NotSigned` on 2026-07-31.

