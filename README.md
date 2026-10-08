<p align="center"><img src="assets/icons/icon-256.png" width="128" alt="Valuables Vault icon"></p>

<h1 align="center">Valuables Vault</h1>

<p align="center"><b>A secure, offline inventory for gold, jewellery, art, documents and everything in your safe or bank locker.</b><br>
Evidence, valuations and insurance in one encrypted record per item — ready for an insurance claim, a locker visit or an estate.</p>

<p align="center"><a href="https://github.com/sachitss/vault/releases/latest"><b>Download</b></a> ·
<a href="https://sachitss.github.io/vault/"><b>Web app (phone &amp; tablet)</b></a> ·
<a href="docs/INSTALL.md">Installation guide</a> ·
<a href="docs/USER_MANUAL.md">User manual</a> ·
<a href="SECURITY.md">Security</a> ·
<a href="docs/DATABASE.md">Database design</a> ·
<a href="docs/ARCHITECTURE.md">Architecture</a></p>

---

## Install

| Device | Download (from the [latest release](https://github.com/sachitss/vault/releases/latest)) | Install |
|---|---|---|
| **Windows 10 / 11** | `Valuables-Vault_<version>_x64-setup.exe` (or `…_en-US.msi` for managed PCs) | Double-click. No admin rights needed. |
| **macOS 10.15+** (Apple silicon + Intel) | `Valuables-Vault_<version>_universal.dmg` | Open, drag **Valuables Vault** to *Applications*; first start: right-click → **Open**. |
| **Linux** | `.deb` (Ubuntu, Debian, Mint), `.rpm` (Fedora, openSUSE) or `.AppImage` (any) | `sudo apt install ./Valuables-Vault_<version>_amd64.deb` · or make the AppImage executable and run it. |
| **Android phones & tablets** (8.0+) | `Valuables-Vault_<version>_android-universal.apk` | Open the file on the device, allow *Install unknown apps* once. |
| **iPhone / iPad** | — | Open **https://sachitss.github.io/vault/** in Safari → Share → **Add to Home Screen**. (Native iOS app once Apple signing is set up.) |
| **Any browser** (Chrome, Edge, Firefox, Safari) | — | **https://sachitss.github.io/vault/** — works offline, can be installed as an app. |
| **No installation / USB stick** | `ValuablesVault-<version>-Standalone.html` | Open the file in a browser. Script-based installers for Windows/macOS/Linux are also attached. |

Checksums are in `SHA256SUMS.txt`. Details, updating and uninstalling: **[docs/INSTALL.md](docs/INSTALL.md)**.

> **Important:** each installation keeps its own encrypted vault on that device. To move or copy your data to another device, use **Backup → Create & verify backup** and **Restore** there. Desktop ↔ phone sync through storage you host is on the roadmap.

## What it does

- **One record per valuable** — category-specific details (gold purity and weight, diamond 4Cs and certificate, artist and provenance, watch reference, coin grade …), inventory IDs like `JWL-2026-00001`.
- **Evidence** — encrypted photos and documents (invoice, certificate, appraisal) with capture date and SHA-256 fingerprint.
- **Valuation history** — purchase, market, replacement, insurance, appraised and estimated values, kept apart, with chart and outdated-valuation alerts.
- **Insurance analysis** — checks your items against the sum insured and the sub-limits (e.g. the typical 20 % valuables limit of German household insurance, limits outside a certified safe, bank-locker cover).
- **Storage & bank lockers** — locker numbers stored encrypted and shown masked; witnessed locker inspections with on-screen signature.
- **Reports** — inventory, photo, insurance, bank locker, estate/inheritance, verification, missing information, QR labels, per-item evidence sheet (print → PDF).
- **Import / export** — CSV and Excel with column mapping, validation and duplicate handling; 9-sheet Excel export. Templates in [`templates/`](templates).
- **Documentation score** — every item shows what is still missing for a claim.
- **Audit trail, recycle bin, encrypted verified backups.**

## Security at a glance

- AES-256-GCM encryption of all records and files; key derived from your password (PBKDF2-SHA-256, 600,000 iterations).
- Works completely offline; nothing is ever uploaded. No accounts, no tracking, no telemetry.
- Auto-lock, failed-unlock throttling, masked confidential numbers, QR labels contain only the inventory ID.
- **The vault password cannot be recovered.** Keep it safe and make regular encrypted backups.

Read **[SECURITY.md](SECURITY.md)** for the threat model and limits of the current version.

## Status

Version **0.9.0** is the first release: one code base that runs as a native app on Windows, macOS, Linux and Android (Tauri 2), as an installable web app in every modern browser, and — once Apple signing is set up — natively on iPhone and iPad. Why this architecture, and its current limits: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Next: the SQLite/SQLCipher storage engine, biometric unlock and desktop ↔ phone sync through storage you own. See [CHANGELOG.md](CHANGELOG.md).

## For developers

```bash
npm ci                                   # bundled libraries (SheetJS, ExcelJS, qrcode-generator)
pip install -r tools/requirements.txt    # build, template and test tooling
python -m playwright install chromium
python3 tools/build.py                   # → dist/valuables-vault.html and dist/pwa/
python3 tests/run_all.py                 # browser tests
python3 tools/package.py                 # → dist/release/ (script installers, standalone file)
npx tauri build                          # → native installers for this OS (needs Rust, see DEVELOPMENT.md)
```

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for the project layout, releases and the web-app deployment, and **[docs/DATABASE.md](docs/DATABASE.md)** for the relational database (SQLite/SQLCipher schema, ER diagrams, integrity rules, migration from app backups).

---

<p align="right"><img src="assets/brand-logo.png" height="60" alt="Team Nepal Solutions – Ing.-Büro Sachit Shrestha"><br>
<sub>Powered by <b>© Ing.-Büro Sachit Shrestha</b> · <a href="mailto:support@medtec24.com">support@medtec24.com</a></sub></p>
