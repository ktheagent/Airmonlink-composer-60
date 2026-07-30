# Build Airmonlink Composer 1.3.0 Build 60 on Windows

## Prerequisites

- Windows 10 or Windows 11 x64
- Node.js 22.12.0
- PowerShell
- Access to the public npm registry
- Optional code-signing certificate for a signed release

## Validate authoritative identity

```powershell
npm ci --no-audit --no-fund
npm run version:check
npm run workflow:check
npm run validate:full
```

The consistency gate must confirm:

```text
APP_VERSION=1.3.0
BUILD_NUMBER=50
BUILD_VERSION=1.3.0.60
PRODUCT_SLUG=Airmonlink-Composer
```

## Build Windows artifacts

```powershell
npm run dist:win
```

Expected files in `release/`:

```text
Airmonlink-Composer-1.3.0-Build60-Setup.exe
Airmonlink-Composer-1.3.0-Build60-Portable.exe
```

## Required verification

1. Confirm each file exists, exceeds 1 MB, and begins with the `MZ` PE signature.
2. Inspect `ProductName` and `ProductVersion`; the version must agree with
   `1.3.0.60`.
3. Install the Setup executable silently into a clean temporary directory.
4. Launch the installed application for a bounded startup window.
5. Launch the Portable executable for a bounded startup window.
6. Save, reopen, export, print to a real or approved virtual printer, and
   uninstall.
7. Upgrade from the supported prior release and verify user-data preservation.
8. Generate and retain SHA-256 checksums.

The GitHub workflow performs automated packaging, PE checks, silent installation,
bounded startup, checksum generation, and artifact upload. Human usability,
upgrade, code signing, physical MIDI, physical printing, and assistive-technology
verification remain separate release gates.
