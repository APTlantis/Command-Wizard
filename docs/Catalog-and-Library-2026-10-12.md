# Command catalog and Library delivery — 2026-10-12

This maintenance candidate implements the approved repository catalog and Library workflow. It remains version 2.0.0 and is not an installed or promoted release. The historical release installer and previous release records are retained.

## Delivered behavior

- Display labels, executable identity, optional families and fixed prefix tokens are independent in TypeScript, Rust, TOML, imports and Schema Studio. Split and nested commands look up their actual executable.
- The rail groups expandable families and exposes matching commands directly when searching. General, PowerShell and Linux routing, Builder-only preview, stacked Parameters/Options, hidden empty Parameters and hidden CLI navigation remain in place.
- Action changes load scoped fields and preserve shared global inputs. Flag identity is case-sensitive; Git `-C` and `-c` are distinct. Global options can precede command prefixes; generic usage placeholders are excluded.
- Library uses a saved-command list/detail editor with titles, notes, categories, tags, optional associations, search, filters, most-recent sorting, duplication, deletion, copy and existing JSON/text exports. Text wraps by default, with a horizontal scrolling alternative.
- Builder saving and pasted commands share the editor. Successful saving offers View in Library and retains Builder inputs. Builder snapshots reopen independently of installed schema changes and check their own executable. Text edits become text-only commands; metadata edits retain snapshots.
- Drafts survive rejected discard decisions and failed writes. Internal navigation, cancel, duplication/reopening and departure protect dirty drafts. Rust preserves original legacy history bytes before the first save and performs atomic replacement. No generated command execution was added.

See [Library contracts](Command-Library-Contract.md) for the data/editor model and [catalog guide](../schemas/README.md) for reproduction and review limits.

## Catalog coverage

401 portable schemas map all 41 supplied existing schemas and 267 core-command references. The 466-file inventory also identifies 152 optional extensions, 3 metadata resources and 3 unsupported sources; no exact-byte duplicates were found. Optional extensions have a separate inventory and are not treated as built-ins.

398 help/version/metadata results preserve probe arguments, output, status, hashes and provenance. Fourteen PowerShell cmdlets were compared with installed parameter metadata. The reviewed catalog includes independent .NET, Cloudflared, OpenSSL, Git, Docker, Cargo, GH and ImageMagick operations and supplied standalone utilities. Advanced alternatives, repetition, mandatory option inputs, parameter sets and intermediate option scopes remain documented per-entry gaps; this is not a full semantic model of every CLI.

All 466 supplied source hashes match their inventory, and all 401 catalog hashes match their coverage records. Neither the temporary references nor live application schemas were replaced. Catalog installation is deliberately absent.

## Verification

| Gate | Result |
| --- | --- |
| `npm run build` | Passed; also run by Tauri before packaging |
| `npm run test` | 437 tests passed across 10 files, including every catalog schema |
| `npm run test:rust` | 10 tests passed, including all catalog TOMLs and Windows atomic persistence |
| `npm run test:ui` | 12 checks passed at 1440×920 and 900×860 |
| `npm run tauri:build` | Final executable and NSIS candidate built |
| Packaged executable launch | Stayed running with native title `CommandWizard` |

Tests cover legacy schema/history compatibility, nested prefixes, scoped fields, flag case, global placement, exact multiline exports, create/edit/duplicate/delete, rejected discard, failed persistence, snapshot restoration after installed schema/executable changes, grouped search and the list/detail/save-review UI. Windows Rust tests preserve history on read-only replacement failure and corrupted existing JSON, verify migration backups, and clean failed temporary files. These use isolated test files, not live history.

Browser screenshots: `artifacts/verification/library-desktop.png`, `library-narrow.png`, `snapshot-desktop.png`, `snapshot-narrow.png`, and the existing command-category checks. Browser mode is in memory and does not establish desktop persistence. The 900px viewport is a stress check below the native 1100px minimum. A footer obstruction found there was fixed by giving narrow workspace rows a scrollable layout.

Native verification is launch-only. Interactive WebView behavior, native discard dialogs and installer install/uninstall were not automated. Before/after hashes found no changes or additions across 47 live schema/history files during the candidate launch. Logs are outside that comparison. The candidate was closed by its own process ID; no live commands were saved, schemas installed, or generated commands executed.

## Candidate artifacts

The final files were copied to a separate candidate directory. The repository [desktop-candidate.json](schema-evidence/desktop-candidate.json), also copied beside the binaries as `verification.json`, records file sizes, hashes, unsigned status, launch process/title and live-data comparison. Build binaries remain ignored; the catalog and review evidence are included by explicit repository ignore exceptions.

| Artifact | SHA-256 |
| --- | --- |
| `artifacts/candidates/library-catalog-2026-10-12/commandwizard.exe` | `B42512EF6BA1D344041263845CF52B34AD682F990D52A61D245131C9624E32F3` |
| `artifacts/candidates/library-catalog-2026-10-12/CommandWizard_2.0.0_x64-setup.exe` | `B09ABD176CBC865B3922276681106080D9E7E4F719832BC2C4BBBC2230B77367` |

Both candidates are unsigned (`NotSigned`). The historical `artifacts/installer/CommandWizard-2.0.0.0-win-x64.exe` retains SHA-256 `6B75295313661A71E0BB14197547A4D377AE5740896B56CA9205CF4CE002CA64`.

Automatic review rejected an intermediate catalog cleanup step because it could delete existing schemas. That step was removed. The final generator performs no deletions or installation; all delivered files have catalog coverage. Help-capture review also excluded graphical Git tools and corrected failed/incorrect help syntax rather than treating errors as definitions. Remaining unavailable probes are explicitly recorded in coverage.
