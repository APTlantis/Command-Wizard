# CommandWizard - Release Checklist

## v2.0.0

Release status: `local-verified`

- [x] Version number matches package metadata, Cargo metadata, Tauri config, manifest, and installer package version.
- [x] Source build completed: `npm run build`.
- [x] Frontend tests passed: `npm run test` passed 23 tests across 6 files.
- [x] Rust tests passed: `npm run test:rust` passed 7 tests.
- [x] UI smoke passed: `npm run test:ui` passed 4 Playwright checks.
- [x] Installer build completed: `npm run tauri:build`.
- [x] Canonical DRS artifact copied from Tauri NSIS output.
- [x] Launch verified from packaged executable with window title `CommandWizard`.
- [x] SHA-256 recorded for final installer artifact.
- [x] Signing status recorded as unsigned / `NotSigned`.
- [ ] Full installer install/uninstall was not executed during this local verification pass.

Final artifact:

* Path: `artifacts/installer/CommandWizard-2.0.0.0-win-x64.exe`
* Runtime: `win-x64`
* Package version: `2.0.0.0`
* Size: `3768522`
* SHA-256: `6B75295313661A71E0BB14197547A4D377AE5740896B56CA9205CF4CE002CA64`

