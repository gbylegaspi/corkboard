# Signing Corkboard (and opening it without signing)

Corkboard builds **without any certificates**. That's fine for personal use: the app works the same either way. The only difference is how much your computer warns you the first time it's opened.

- **macOS** builds are *ad-hoc signed* (`identity: "-"` in `electron-builder.yml`). The signature isn't tied to a developer account. Apple Silicon Macs need at least that much to run an app at all. Gatekeeper still treats the app as being from an "unidentified developer".
- **Windows** builds are unsigned. SmartScreen shows a warning on first launch.

## Opening an unsigned build

### macOS

1. Open `Corkboard-<version>-mac-universal.dmg` and drag **Corkboard** onto **Applications**.
2. Open Corkboard from Applications. macOS says it can't verify the app. Click **Done** (or **OK**), not "Move to Bin".
3. Open **System Settings → Privacy & Security** and scroll down to the message about Corkboard. Click **Open Anyway** and confirm with your password or Touch ID.
4. From then on it opens normally.

On older macOS (14 Sonoma and earlier) the shortcut also works: **right-click (or Control-click) Corkboard in Applications → Open → Open**. macOS 15 and later removed that shortcut, so use step 3 there.

If a copy downloaded from the internet says the app "is damaged", that's the quarantine flag on an unsigned download, not real damage. You can clear it in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Corkboard.app
```

### Windows

- **Installer** (`Corkboard-<version>-setup-x64.exe`, or `-arm64` for ARM PCs): if "Windows protected your PC" appears, click **More info → Run anyway**. It installs for the current user only, with no administrator rights needed.
- **Portable** (`Corkboard-<version>-portable-x64.exe`): the same **More info → Run anyway** the first time. It runs without installing.

## Signing for real

### macOS: Developer ID + notarisation

You need an Apple Developer Program membership (paid, yearly).

1. **Certificate.** In Xcode (Settings → Accounts → Manage Certificates → +) or on developer.apple.com, create a **Developer ID Application** certificate. Keep it in your login keychain, or export it as a `.p12` with a password.
2. **Turn off ad-hoc signing.** In `electron-builder.yml`, under `mac:`, change:
   ```yaml
   # identity: "-"              # remove this line
   hardenedRuntime: true         # required for notarisation
   notarize: true
   ```
   electron-builder's default entitlements already allow what Electron needs (JIT for V8).
3. **Tell electron-builder which certificate to use.** Either keep it in the keychain (it's found automatically), or set:
   ```bash
   export CSC_LINK=/path/to/DeveloperID.p12      # or a base64 string of it
   export CSC_KEY_PASSWORD='the .p12 password'
   ```
4. **Notarisation credentials** (Apple scans the app and staples a ticket to it). Use one of these:
   - Apple ID: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (create one at appleid.apple.com → Sign-In and Security → App-Specific Passwords), and `APPLE_TEAM_ID`.
   - App Store Connect API key: `APPLE_API_KEY` (path to the `.p8` file), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`.
5. Build: `npm run build:mac`. electron-builder signs the app, submits it for notarisation, waits, and staples the ticket.
6. Check the result:
   ```bash
   spctl --assess --type execute -vv dist/mac-universal/Corkboard.app   # should say: accepted, source=Notarized Developer ID
   xcrun stapler validate dist/Corkboard-*.dmg
   ```

### Windows: Authenticode

Any of these works with electron-builder:

- **A code-signing certificate file (`.pfx`)** from a certificate authority (Sectigo, DigiCert, SSL.com and others):
  ```bash
  set CSC_LINK=C:\path\to\cert.pfx
  set CSC_KEY_PASSWORD=the-password
  npm run build:win
  ```
  Since 2023, new OV/EV certificates are issued on hardware tokens or in cloud HSMs, not as plain files. For those, use the vendor's signing tool through electron-builder's `win.signtoolOptions` / a custom `sign` script.
- **Azure Trusted Signing** (Microsoft's cheaper cloud signing): set `win.azureSignOptions` in `electron-builder.yml` (endpoint, certificate profile name, code signing account name) and sign in with the Azure CLI or environment credentials.

A signed build still starts with little SmartScreen "reputation". The warning fades as more people run that signed app. EV certificates used to skip this, but no longer do.

`signAndEditExecutable: true` (already set) is also what puts the icon and version information into the `.exe`. Building for Windows on a Windows PC (or a Windows CI runner) is the reliable way to get that right.
