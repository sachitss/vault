# Installing Valuables Vault

Valuables Vault runs on Windows, macOS, Linux, Android, iPhone and iPad. Desktop installers need **no administrator rights** and install for the current user only. Download the files from the [latest release](https://github.com/sachitss/vault/releases/latest).

**Before you start:** each installation keeps its own encrypted vault. The vault password cannot be recovered — store it in a password manager or sealed with your estate papers.

## Windows 10 / 11

1. Download `ValuablesVault-<version>-Windows.zip`.
2. Right-click it → **Extract All…** → **Extract**. (Running the installer from inside the ZIP does not work.)
3. In the extracted folder, double-click **`install.bat`**.
   If Windows SmartScreen shows "Windows protected your PC": **More info** → **Run anyway**. The scripts are plain text; you can read them first.
4. Start **Valuables Vault** from the Start menu or the desktop shortcut.

What the installer does:

- copies the app to `%LOCALAPPDATA%\Programs\ValuablesVault`
- creates Start-menu and desktop shortcuts that open the app **in its own window** with Microsoft Edge (or Chrome/Brave if Edge is missing)
- adds **Valuables Vault** to *Settings → Apps* so it can be uninstalled normally

Options (PowerShell): `install.ps1 -NoDesktopShortcut`, `-NoLaunch`, `-WhatIf` (show what would happen).

## macOS 10.13 or later

1. Download `ValuablesVault-<version>-macOS.zip` and double-click it to unpack.
2. **Right-click** `install.command` → **Open** → **Open**. (Needed once: the script is not from the App Store. A plain double-click shows a warning instead.)
3. Start **Valuables Vault** from Launchpad, Spotlight or `~/Applications`.

The installer creates `~/Applications/Valuables Vault.app`. It opens in its own window with Chrome, Edge or Brave if installed, otherwise in Safari.

## Linux

```bash
tar xzf ValuablesVault-<version>-Linux.tar.gz
./ValuablesVault-<version>-Linux/install.sh
```

Start it from your application menu or with `valuables-vault`. The app is installed to `~/ValuablesVault` (a visible folder, so snap/flatpak browsers such as Ubuntu's Chromium can open it), with a menu entry and icon in `~/.local/share` and a command in `~/.local/bin`. It opens in its own window with Chrome, Chromium, Edge or Brave, otherwise in your default browser. `VV_HOME=/path ./install.sh` installs elsewhere.

## Android

1. Open **https://sachitss.github.io/vault/** in **Chrome**.
2. Menu (⋮) → **Install app** (or **Add to Home screen**).
3. Open **Vault** from the home screen. After the first start it works completely offline.

## iPhone and iPad

1. Open **https://sachitss.github.io/vault/** in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open **Vault** from the home screen. After the first start it works offline.

iOS may delete website data of home-screen apps that have not been opened for several weeks if the device runs low on storage. Open the app regularly and **keep encrypted backups** (Backup → Create & verify backup → save to Files / iCloud Drive).

The web app only downloads the program. Your vault data is encrypted on the phone and is never sent to GitHub or anywhere else.

## Standalone file (USB stick, no installation)

Open `ValuablesVault-<version>-Standalone.html` in Chrome, Edge, Firefox or Safari. Always open the same file from the same location with the same browser — the vault is tied to both.

## Updating

Install the new version the same way. Your data stays: it is stored in the browser profile, not in the program folder. The web app on phones updates itself the next time it is opened online.

## Moving data between devices

Every installation (Windows PC, laptop, phone, web app) has its **own separate vault**. To copy your inventory:

1. On the old device: **Backup → Create & verify backup** (optionally with a separate backup password).
2. Move the `.vaultbak` file (USB stick, your own cloud folder, e-mail to yourself — it is encrypted).
3. On the new device: **Backup → Restore from backup file…**

Automatic desktop ↔ phone sync through your own storage (NAS, WebDAV or cloud folder) is part of the native app (Phase 1 of the roadmap).

## Uninstalling

| Platform | How |
|---|---|
| Windows | *Settings → Apps → Valuables Vault → Uninstall*, or run `uninstall.ps1` in `%LOCALAPPDATA%\Programs\ValuablesVault` |
| macOS | Run `uninstall.command` from the download, or drag `~/Applications/Valuables Vault.app` to the Bin |
| Linux | `~/ValuablesVault/uninstall.sh` (your backup files in that folder are kept) |
| Android / iOS | Long-press the icon → remove the app |

Uninstalling **does not delete your encrypted vault data**, so a re-install brings it back. To delete the data, open the app first and use **Settings → Erase vault on this device** (after making a backup).

## Where is my data?

In the browser profile of the browser that opens the app (IndexedDB), always encrypted. It is **deleted if you clear "cookies and site data"** for local files or for `sachitss.github.io` in that browser — another reason for regular backups.

## Help

support@medtec24.com · Powered by © Ing.-Büro Sachit Shrestha
