# CommandWizard v1.0.5

CommandWizard v1.0.5 is the first local signed MSIX release built from the
current, correct source tree: light Material Design theme, the Delete Schema
button, and the Arguments grid's Value Style column. It supersedes the prior
`v1.0.0.0` artifact, which was packaged from a stale pre-theme-change build and
is no longer distributed.

## Theme

Material Design Light — WPF / Material Design In XAML Toolkit light palette,
Blue primary / LightBlue secondary (`MaterialDesignThemes.Wpf`, `BundledTheme
BaseTheme="Light" PrimaryColor="Blue" SecondaryColor="LightBlue"`). All surfaces
use the `MaterialDesignWindow` style.

## Design Boundaries

- **Local-only data**: All schema TOML files and favorites history are stored
  in the user's AppData folder. No network calls, no cloud sync, no telemetry.
- **Schema-first, no code generation**: The wizard only assembles CLI command
  strings from static schema definitions. It does not execute commands, spawn
  processes on behalf of the user, or modify the system PATH except via an
  explicit opt-in button.

## Built With

| Dependency | Version | Purpose |
|---|---|---|
| .NET 10 | 10.0 | Runtime and SDK |
| WPF | (inbox) | UI framework |
| MaterialDesignThemes.Wpf | 5.x | Light Material Design styling |
| Tomlyn | 0.19.x | TOML parsing and serialization |
| Windows App SDK | 1.8.x | MSIX packaging and identity |

## Signing

Signed with a locally generated self-signed developer certificate
(`CN=Administrator`, thumbprint `C03F83DE2A4964918A6D1D10C0F5D88B39647B11`,
expires 2027-03-14). The certificate must be imported into the Trusted Root /
Trusted People store on each target machine before the MSIX can be installed.
This is not a Microsoft Store submission and the certificate is not publicly
trusted.

## What changed from v1.0.0.0

- Theme reverted to light (the shipped `v1.0.0.0` MSIX predated the
  `e5687fa` "Changed theme" commit and was still dark).
- Restored the "Value Style" column to the Schema Editor's Arguments grid,
  which had been dropped during a `MainWindow.xaml` reformat.
- Fixed `appxmanifest.xml`: `Executable="$targetnametoken$.exe"` (a Visual
  Studio MSIX-packaging-project placeholder that only gets substituted by
  MSBuild) was left in place and rejected by `makeappx`/`winapp package` when
  packaging via CLI. Changed to `Executable="CommandWizard.exe"`.
- Test suite grew from 11 to 26 tests; all pass.

## Highlights

- Builds CLI commands from TOML tool schemas.
- Supports schema editing, help-text import, options, parameters, tags, and
  favorite commands.
- Ships with a local signed MSIX package identity version of `1.0.5.0`.
- Uses the final Command Wizard logo for Store, square, and wide tile assets.
- Includes a repeatable packaging script at `scripts\package-msix.ps1`.

## Installer

The release package is generated at:

```text
dist\CommandWizard-1.0.5.0.msix
```

**SHA-256:** `24557f08aed5524bbd396d60323a28bc2fa82b9f5969404844693d20e6fc6733`

The package is signed with the local development certificate:

```text
Subject: CN=Administrator
Thumbprint: C03F83DE2A4964918A6D1D10C0F5D88B39647B11
Expires: 2027-03-14
```

This certificate is intended for local machines and trusted testers only.

## Install

Trust the certificate once on each machine:

```powershell
winapp cert install .\devcert.pfx
```

Install the MSIX:

```powershell
Add-AppxPackage .\dist\CommandWizard-1.0.5.0.msix
```

Launch **Aptlantis Command Wizard** from the Start menu.

## Verification

The v1.0.5 release was verified with:

```powershell
dotnet build .\CommandWizard.csproj -c Release
dotnet test .\CommandWizard.Tests\CommandWizard.Tests.csproj -c Release
.\scripts\package-msix.ps1
Get-AuthenticodeSignature .\dist\CommandWizard-1.0.5.0.msix
Add-AppxPackage .\dist\CommandWizard-1.0.5.0.msix
```

Results:

- Release build succeeded.
- Test suite passed: `26/26`.
- MSIX signature status: `Valid`.
- Installed package version: `1.0.5.0`.
- Installed app launched with title `Aptlantis Command Wizard`; UI visually
  confirmed to match the target reference screenshot (light theme, Delete
  Schema button, Value Style column present).
- Uninstall verified clean (no leftover package or AppData entries observed
  for a fresh, unused install).

Evidence bundle: `release-evidence/v1.0.5/` (filehash.txt, build.log, test.log,
install-check.txt).

## Notes

- This is a local signed release, not a Microsoft Store submission.
- Public distribution should replace `devcert.pfx` with a trusted code-signing
  certificate and update the manifest publisher to match.
- `scripts\package-msix.ps1` was updated to invoke `makeappx.exe`/`signtool.exe`
  directly (auto-discovered from the cached `Microsoft.Windows.SDK.BuildTools`
  NuGet package) instead of `winapp package`/`winapp sign`, working around the
  CLI bug described above. Re-running the script reproduces a valid, differently
  -hashed MSIX each time (packaging isn't byte-for-byte reproducible); this
  release's evidence reflects the script-produced artifact.
