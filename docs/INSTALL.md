# Installing Valuables Vault

Valuables Vault runs on Windows, macOS, Linux, Android, iPhone and iPad. Desktop installers need **no administrator rights** and install for the current user only. Download the files from the [latest release](https://github.com/sachitss/vault/releases/latest).

**Before you start:** each installation keeps its own encrypted vault. The vault password cannot be recovered — store it in a password manager or sealed with your estate papers.

**Languages:** the app, its reports and exports are available in **English, Deutsch and नेपाली**. Choose the language on the first screen (or later on the lock screen or in *Settings*); it follows your device language until you choose. The Windows installer asks for English, German or Nepali.

There are three ways to install. **Use the native app** where you can: it keeps the vault in the app's own storage, where no browser clean-up can delete it.

| | Native app | Web app | Script installer / standalone file |
|---|---|---|---|
| Windows, macOS, Linux | ✅ recommended | ✅ | ✅ (opens in a browser app window) |
| Android phones & tablets | ✅ recommended | ✅ | — |
| iPhone & iPad | ✅ via sideloading (see below); App Store after Apple signing | ✅ simplest | — |
| Data stored in | app storage | browser storage | browser storage |

## Windows 10 / 11 — native app

1. Download `Valuables-Vault_<version>_x64-setup.exe`.
2. Double-click it. If SmartScreen shows "Windows protected your PC" (the app is not yet code-signed): **More info** → **Run anyway**.
3. Follow the installer (English or German). It installs for your user only — no administrator rights — and adds Start-menu and desktop entries.

For company PCs managed with Group Policy / Intune, use `Valuables-Vault_<version>_x64_en-US.msi` (or `_de-DE.msi`) instead. The installer downloads Microsoft's WebView2 runtime if the PC does not have it (it is built into Windows 11).

## macOS 10.15 or later — native app

1. Download `Valuables-Vault_<version>_universal.dmg` (runs natively on Apple silicon and Intel Macs).
2. Open it and drag **Valuables Vault** to **Applications**.
3. First start: in *Applications*, **right-click** Valuables Vault → **Open** → **Open**. (Needed once while the app is not notarised by Apple.) If macOS says the app "is damaged", run `xattr -dr com.apple.quarantine "/Applications/Valuables Vault.app"` in Terminal.

## Linux — native app

| Distribution | File | Install |
|---|---|---|
| Ubuntu, Debian, Mint, Pop!_OS | `Valuables-Vault_<version>_amd64.deb` | `sudo apt install ./Valuables-Vault_<version>_amd64.deb` |
| Fedora, RHEL, openSUSE | `Valuables-Vault-<version>-1.x86_64.rpm` | `sudo dnf install ./Valuables-Vault-<version>-1.x86_64.rpm` |
| Any other (no installation) | `Valuables-Vault_<version>_amd64.AppImage` | `chmod +x Valuables-Vault_*.AppImage && ./Valuables-Vault_*.AppImage` |

Start it from the application menu or with `valuables-vault`.

## Android phones and tablets — native app

1. On the phone or tablet, download `Valuables-Vault_<version>_android-universal.apk` from the release page.
2. Open the downloaded file. Android asks once to allow your browser or file manager to **install unknown apps** — allow it, then **Install**.
3. Open **Valuables Vault**. *Scan QR* uses the camera (Android asks for permission the first time).

Android 8.0 or later. The `.aab` file in the release is for publishing in Google Play, not for direct installation.

## iPhone and iPad — web app (simplest)

1. Open **https://sachitss.github.io/vault/** in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open **Vault** from the home screen. After the first start it works offline.

iOS may delete website data of home-screen apps that have not been opened for several weeks if the device runs low on storage. Open the app regularly and **keep encrypted backups** (Backup → Create & verify backup → save to Files / iCloud Drive).

## iPhone and iPad — native app (sideloading)

Apple installs apps only from the App Store, TestFlight, or signed with your own Apple ID. Until Valuables Vault is in the App Store, the release contains `Valuables-Vault_<version>_ios-unsigned.ipa`, which you sign with your own Apple ID on a computer:

1. Install **[Sideloadly](https://sideloadly.io)** (Windows or Mac) — or AltStore.
2. Connect the iPhone/iPad by cable and trust the computer.
3. Drag the `.ipa` into Sideloadly, enter your Apple ID, click **Start**. (Use an app-specific password if your Apple ID has two-factor authentication.)
4. On the device: *Settings → General → VPN & Device Management* → your Apple ID → **Trust**. On iOS 16+ also enable *Settings → Privacy & Security → Developer Mode* (restart required).

With a free Apple ID the app must be re-signed **every 7 days** (Sideloadly can do this automatically over Wi-Fi); your vault data stays when you re-sign. With a paid Apple Developer account it lasts a year. iOS 14 or later, iPhone and iPad.

## Any browser — web app

Open **https://sachitss.github.io/vault/** in Chrome, Edge, Firefox or Safari. Chrome and Edge offer **Install app** in the address bar; on Android, Chrome menu (⋮) → **Install app**. The web app only downloads the program; your vault data is encrypted on the device and is never sent to GitHub or anywhere else.

## Script installers (alternative for desktops)

Small installers that open the app in its own browser window — useful where the native installer cannot be used.

- **Windows:** extract `ValuablesVault-<version>-Windows.zip` (right-click → *Extract All*), double-click **`install.bat`**. Installs to `%LOCALAPPDATA%\Programs\ValuablesVault` with Start-menu and desktop shortcuts using Edge (or Chrome/Brave). Options: `install.ps1 -NoDesktopShortcut`, `-NoLaunch`, `-WhatIf`.
- **macOS 10.13+:** unzip `ValuablesVault-<version>-macOS.zip`, right-click **`install.command`** → **Open**. Creates `~/Applications/Valuables Vault.app` (Chrome, Edge or Brave, otherwise Safari).
- **Linux:** `tar xzf ValuablesVault-<version>-Linux.tar.gz && ./ValuablesVault-<version>-Linux/install.sh`. Installs to `~/ValuablesVault` with a menu entry and the `valuables-vault` command (`VV_HOME=/path` to choose another folder).

## Standalone file (USB stick, no installation)

Open `ValuablesVault-<version>-Standalone.html` in Chrome, Edge, Firefox or Safari. Always open the same file from the same location with the same browser — the vault is tied to both.

## Updating

Install the new version the same way, over the old one. Your data stays: it is kept in the app's storage (native app) or the browser profile (web app, script installer), not in the program folder. The web app updates itself the next time it is opened online. On Android, an update installs over the old version only if both were signed with the same release key — otherwise make a backup, uninstall, install, restore.

## Automatic updates and reminders

- **Windows, macOS, Linux:** the app checks for a new version about once a day. When one is available it shows what is new; *Install and restart* downloads it, verifies its signature and installs it. Your data stays. (Linux .deb/.rpm: you are asked for your administrator password.)
- **Android:** apps from Google Play update through the store; the APK version shows a notice with a download link.
- **iPhone/iPad and the web app:** the web app updates itself; the sideloaded app shows a notice.
- Turn the check off in *Settings → Notifications & updates*. Only the version number is requested from GitHub — never any vault data.

**Reminders** (insurance renewal, backup due, bank-locker review, outdated valuations, expiring documents) arrive as notifications — on phones and tablets also when the app is closed. Allow notifications when asked, or later in *Settings → Notifications & updates*. They never contain names or amounts.

## Moving data between devices

Every installation (Windows PC, laptop, phone, web app) has its **own separate vault**. To copy your inventory:

1. On the old device: **Backup → Create & verify backup** (optionally with a separate backup password).
2. Move the `.vaultbak` file (USB stick, your own cloud folder, e-mail to yourself — it is encrypted).
3. On the new device: **Backup → Restore from backup file…**

Automatic desktop ↔ phone sync through storage you host (NAS, WebDAV or your cloud folder) is on the roadmap.

## Uninstalling

| Platform | How |
|---|---|
| Native app — Windows | *Settings → Apps → Valuables Vault → Uninstall* |
| Native app — macOS | Drag *Valuables Vault* from *Applications* to the Bin |
| Native app — Linux | `sudo apt remove valuables-vault` / `sudo dnf remove valuables-vault` / delete the AppImage |
| Native app — Android, iPhone, iPad | Long-press the icon → *Uninstall* / *Remove App* (this **deletes the vault on the device** — back up first) |
| Script installer — Windows | *Settings → Apps → Valuables Vault → Uninstall*, or run `uninstall.ps1` in `%LOCALAPPDATA%\Programs\ValuablesVault` |
| Script installer — macOS | Run `uninstall.command` from the download, or drag `~/Applications/Valuables Vault.app` to the Bin |
| Script installer — Linux | `~/ValuablesVault/uninstall.sh` (your backup files in that folder are kept) |
| Web app | Long-press the icon → remove the app, or uninstall it from the browser |

On desktops, uninstalling **does not delete your encrypted vault data**, so a re-install brings it back (Android removes app data with the app). To delete the data, open the app first and use **Settings → Erase vault on this device** (after making a backup).

## Where is my data?

Always encrypted, and only on the device:

- **Native app:** in the app's private folder — Windows `%LOCALAPPDATA%\com.medtec24.valuablesvault`, macOS `~/Library/WebKit/com.medtec24.valuablesvault`, Linux `~/.local/share/com.medtec24.valuablesvault`, Android/iOS the app's sandbox. Clearing browser data does not touch it.
- **Web app, script installer, standalone file:** in the profile of the browser that opens the app (IndexedDB). It is **deleted if you clear "cookies and site data"** for local files or for `sachitss.github.io` in that browser — another reason for regular backups.

## Help

support@medtec24.com · Powered by © Ing.-Büro Sachit Shrestha
