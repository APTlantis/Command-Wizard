# Command category maintenance — 2026-10-12

This maintenance candidate reorganizes Builder into General, PowerShell, and Linux (WSL). It groups cmdlets by command identity, recognizes common Linux utilities, and allows explicit assignment of any imported app through Schema Studio. Category assignments are saved with the existing TOML tag contract, without a persisted-data migration. Unassigned apps remain General. Linux/WSL categorization does not add a `wsl` prefix to the copied command; copy the command into its intended shell.

Command Preview is mounted only in Builder with a selected command. Other workspaces reclaim its column. Parameters precede Options, use two columns when space permits, span the final odd item across both columns, and disappear when empty. CLI navigation is hidden; the underlying feature and user data have not been deleted. Generic Not ready and Needs Review badges are suppressed while specific validation details remain visible. PowerShell cmdlet and Linux/WSL availability is reported as unchecked rather than inferred from Windows PATH.

The only added UI dependency is daisyUI 5, restricted to prefixed tab styles with built-in themes disabled; existing Blue Slate surfaces are preserved. Generated commands remain copy/export only. Help and completion import probes are unchanged.

## Verification

- `npm run build`: passed.
- `npm run test`: 27 tests passed across 7 files.
- `npm run test:rust`: 7 Rust tests passed.
- `npm run test:ui`: 8 checks passed at 1440×920 and 900×860. The latter is a browser stress viewport below the desktop window's 1100px minimum; it does not establish a supported native window size.
- `npm run tauri:build`: executable and NSIS candidate built; final hashes and launch evidence below.

Initial sandbox runs hit temporary-file rename, cached Tauri API read, and local server restrictions. These checks were rerun successfully outside the sandbox. The matching Playwright Chromium browser was installed for UI checks.

Unit coverage verifies cmdlet/system-utility routing, explicit override persistence through TOML, installed-app categorization, search/selection isolation, preview visibility across workspaces and empty categories, and empty/odd parameter layouts. Browser checks verify rendered Parameters precede Options, an odd third parameter fills the row, an imported cmdlet opens in PowerShell, explicit reassignment changes its tab, and the preview disappears on non-Builder workspaces. Captures are in `artifacts/verification/command-categories-desktop.png` and `artifacts/verification/command-categories-narrow.png`. Automatic cmdlet classification follows the local PowerShell approved-verb catalog and built-in legacy verbs; explicit assignment handles custom names or naming collisions.

The existing `artifacts/installer/CommandWizard-2.0.0.0-win-x64.exe` and manifest release hash remain the historical release. A newly built local candidate is not an installed or promoted release. Installer install/uninstall and Linux/WSL execution are outside this verification.

## Desktop candidate

The final packaged executable was launched and closed after verification. Its process stayed running and exposed a native window titled `CommandWizard`. This proves launch; interactive behavior was checked in the browser tests, not through native desktop automation.

| Artifact | SHA-256 |
| --- | --- |
| `src-tauri/target/release/commandwizard.exe` | `99723628ACF031A50D9A3092ED9BD1B8665B619B48893E9BECC0CFAA02DD112A` |
| `src-tauri/target/release/bundle/nsis/CommandWizard_2.0.0_x64-setup.exe` | `9F0E14BBE23F137A7200C34F2F1A33FBDDF2751259A7DD511A9034B1C0318B7E` |

The installer candidate is unsigned (`Get-AuthenticodeSignature`: `NotSigned`). Version remains 2.0.0; this is a local maintenance candidate, not a new release declaration.

No parent manifest or drive navigation changes are needed: project identity, portfolio ownership, standards, and discovery paths remain unchanged. The project manifest root was reconciled to the physical `D:\DRS\Command-Wizard` directory. Pre-existing user edits were retained.
