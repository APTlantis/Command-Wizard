# CommandWizard Instructions

Inherit the parent portfolio and [drive instructions](D:/AGENTS.md).

## Read first

1. `CommandWizard.manifest.toml`
2. `Project-README.md`
3. Existing project README, process, or rules documents
4. [DRS canonical standard](D:/.library/aptlantis_core/DRS/README.md)

## Local boundaries

Tauri, React, TypeScript, Tailwind, and Rust desktop application for constructing and managing command workflows.

Use the Node/Rust project files and current test suites. Verify with `npm run build`, `npm run test`, `npm run test:rust`, `npm run test:ui`, Tauri launch, and packaged behavior where applicable.

Generated commands are copy/export only. Help capture and completion probing are explicit import probes and must remain separate from generated-command execution.
