# CommandWizard v1.0.0

CommandWizard v1.0.0 is the first local signed MSIX release of the schema-driven command builder. It packages the desktop app as **Aptlantis Command Wizard** with bundled Windows App SDK runtime files, local signing, and the final Command Wizard logo assets.

## Theme

Material Design Dark — WPF / Material Design In XAML Toolkit dark palette with teal accent. All surfaces use the MaterialDesignWindow style from the `MaterialDesignThemes.Wpf` package.

## Design Boundaries

- **Local-only data**: All schema TOML files and favorites history are stored in the user's AppData folder. No network calls, no cloud sync, no telemetry.
- **Schema-first, no code generation**: The wizard only assembles CLI command strings from static schema definitions. It does not execute commands, spawn processes on behalf of the user, or modify the system PATH except via an explicit opt-in button.

## Built With

| Dependency | Version | Purpose |
|---|---|---|
| .NET 10 | 10.0 | Runtime and SDK |
| WPF | (inbox) | UI framework |
| MaterialDesignThemes.Wpf | 5.x | Dark Material Design styling |
| Tomlyn | 0.19.x | TOML parsing and serialization |
| Windows App SDK | 1.6.x | MSIX packaging and identity |

## Signing

Signed with a locally generated self-signed developer certificate (`CN=Administrator`, thumbprint `C03F83DE2A4964918A6D1D10C0F5D88B39647B11`, expires 2027-03-14). The certificate must be imported into the Trusted Root / Trusted People store on each target machine before the MSIX can be installed. This is not a Microsoft Store submission and the certificate is not publicly trusted.

## Highlights

- Builds CLI commands from TOML tool schemas.
- Supports schema editing, help-text import, options, parameters, tags, and favorite commands.
- Ships with a local signed MSIX package identity version of `1.0.0.0`.
- Uses the final Command Wizard logo for Store, square, and wide tile assets.
- Includes a repeatable packaging script at `scripts\package-msix.ps1`.

## Installer

The release package is generated at:

```text
dist\CommandWizard-1.0.0.0.msix
```

**SHA-256:** `995CEE8972C2D086B9148D9F93F3ADC8B55C1F1CED45CE75A39C49BACE7B346D`

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
Add-AppxPackage .\dist\CommandWizard-1.0.0.0.msix
```

Launch **Aptlantis Command Wizard** from the Start menu.

## Verification

The v1.0.0 release was verified with:

```powershell
dotnet build .\CommandWizard.csproj -c Release
dotnet test .\CommandWizard.Tests\CommandWizard.Tests.csproj -c Release
.\scripts\package-msix.ps1
Get-AuthenticodeSignature .\dist\CommandWizard-1.0.0.0.msix
Add-AppxPackage .\dist\CommandWizard-1.0.0.0.msix
```

Results:

- Release build succeeded.
- Test suite passed: `11/11`.
- MSIX signature status: `Valid`.
- Installed package version: `1.0.0.0`.
- Installed app launched with title `Aptlantis Command Wizard`.

## Notes

- This is a local signed release, not a Microsoft Store submission.
- Public distribution should replace `devcert.pfx` with a trusted code-signing certificate and update the manifest publisher to match.
