# CommandWizard v1.0.1

## Changes

- Switched UI from dark theme to standard light mode (white/gray background, blue accent).
- Schema Details panel: grouped fields into bordered cards with rounded corners and consistent spacing so sections no longer blend together.

## Installer

```text
dist\CommandWizard-1.0.1.0.msix
```

Signed with the local development certificate:

```text
Subject: CN=Administrator
Thumbprint: C03F83DE2A4964918A6D1D10C0F5D88B39647B11
Expires: 2027-03-14
```

## Install

Trust the certificate once on each machine:

```powershell
winapp cert install .\devcert.pfx
```

Install the MSIX:

```powershell
Add-AppxPackage .\dist\CommandWizard-1.0.1.0.msix
```
