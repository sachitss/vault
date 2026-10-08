# Architecture and technology decision

**Decision (October 2026):** one web core (HTML/CSS/JavaScript, Web Crypto) runs everywhere.
Browsers use it as an installable web app (PWA). Windows, macOS, Linux, Android, iOS and iPadOS
get native installers from a thin **Tauri 2** shell around the same core.

```
                       src/  (one code base: UI, encryption, inventory, reports, import/export)
                                          │  tools/build.py
           ┌──────────────────────────────┼────────────────────────────────┐
  dist/valuables-vault.html        dist/pwa/  (GitHub Pages)          dist/app/  ──►  src-tauri/ (Rust)
  single file, USB stick           Chrome · Edge · Firefox · Safari         │
                                   installable, offline                     ├─ Windows  .msi / setup .exe
                                                                            ├─ macOS    universal .dmg
                                                                            ├─ Linux    .deb / .rpm / .AppImage
                                                                            ├─ Android  .apk / .aab (phones, tablets)
                                                                            └─ iOS      .ipa (iPhone, iPad; sideload now, App Store with Apple signing)
```

`src/platform.js` is the only place that knows where the app runs. In a browser it does
nothing new. Inside the native shell it routes saving to the OS save dialog, shows reports in
an in-app viewer with print / save, opens links in the system browser and scans QR codes with
the camera on phones and tablets.

## Options evaluated

Scores 1 (poor) – 5 (best) for this app: a single-owner, offline, encrypted inventory with photos,
documents, reports and Excel/CSV.

| Criterion | Flutter | React Native | .NET MAUI | PWA only | Server web app | **Tauri 2 + web core** |
|---|---|---|---|---|---|---|
| Security | 4 | 3 | 4 | 3 | 2 — data on a server | **5** — Rust core, deny-by-default capabilities, strict CSP, no network |
| Offline | 5 | 5 | 5 | 4 — browser can evict data (iOS) | 1 | **5** — app storage is not cleared by browsers |
| Camera | 5 | 5 | 4 | 3 — photo capture yes, scanning limited | 3 | **4** — photo capture + native QR scan on mobile |
| Document handling (PDF, images) | 3 — needs plugins | 3 | 3 | 5 | 5 | **5** — browser engine previews PDF/images |
| Database reliability | 5 (SQLite) | 4 | 5 | 3 (IndexedDB) | 5 | **4** today (IndexedDB in app storage), 5 with the SQLite schema in `db/` |
| Cross-platform incl. web | 4 — web build is weaker | 3 — web via RN-Web | 2 — no Linux, no web | 4 — no store apps | 5 browser only | **5** — all 8 targets from one code base |
| Long-term maintenance | 3 — second code base (Dart) | 3 | 3 | 5 | 3 — servers to run | **5** — one code base; tested core reused unchanged |
| Performance | 5 | 4 | 4 | 4 | 3 | **4** — native webview, 3 MB installers on Windows/macOS/Linux |
| Export (Excel, CSV, PDF) | 3 | 3 | 4 | 5 | 5 | **5** — styled Excel, CSV, print-to-PDF |
| **Total** | 37 | 33 | 34 | 36 | 32 | **42** |

Why not Flutter, the earlier recommendation in the specification: it is an excellent choice for
a new mobile-first app, but here it would mean rewriting a working, tested core (encryption,
import with EU number/date parsing, insurance analysis, reports, styled Excel export) in Dart
and maintaining two code bases, because browsers would still need the web version. Its web
output is also weaker than a plain web app for document-heavy screens.

## Security model of the native shell

- **No data leaves the device.** The Content-Security-Policy (`src-tauri/tauri.conf.json`) allows only Tauri's local IPC channel and the GitHub Releases API (version check). Vault data is never sent anywhere.
- **Deny by default.** `src-tauri/capabilities/` grants the window exactly: save/open/message
  dialogs, writing the file the user picked, opening links, and (phones/tablets) the QR scanner.
  No shell, no file reading by path, no HTTP.
- **Same encryption** as the web app: AES-256-GCM, PBKDF2-SHA256 600,000 iterations; the vault
  is stored encrypted in the app's private data folder
  (Windows `%LOCALAPPDATA%\com.medtec24.valuablesvault`, macOS `~/Library/WebKit/com.medtec24.valuablesvault`,
  Linux `~/.local/share/com.medtec24.valuablesvault`, Android/iOS app sandbox).
- **Single instance** on desktop, so two windows can never write the same vault at once.

## Languages, updates and notifications

- **Languages** — the web core is written in English; a translation layer (`src/i18n.js`) translates screens, dialogs, reports and exports into German and Nepali from dictionaries, with patterns for text containing numbers or names. One build contains all three languages.
- **Updates** — desktop: Tauri updater with minisign signatures; the public key is compiled in, so only updates signed with the project's private key are installed. `latest.json` lives on the GitHub release. Mobile and the standalone file: a version check against the GitHub Releases API (allowed by the CSP as the only network destination) and a download notice.
- **Notifications** — computed on the device from the unlocked vault; only dates and reminder kinds are stored outside the encrypted vault so they can fire while it is locked. Phones and tablets schedule them in the OS (tauri-plugin-notification).

## Honest limits

| Topic | Status |
|---|---|
| iOS / iPadOS native app | Apple only installs signed apps. CI builds an unsigned `.ipa` that users sign with their own Apple ID (Sideloadly/AltStore; free IDs re-sign every 7 days), and an App Store/TestFlight build once Apple Developer secrets are added. The web app remains the simplest option on iPhone and iPad. |
| Windows SmartScreen / macOS Gatekeeper | Builds are unsigned until code-signing certificates are added as secrets (the workflow already supports them). Users see a one-time warning (see INSTALL.md). |
| Android signing | Without the `ANDROID_KEYSTORE_*` secrets each build is signed with a throwaway key; it installs, but cannot update an earlier install in place. Create one release key and keep it safe. |
| Android save dialog | Uses the system document picker; tested in CI build only, not on a physical device here. |
| Printing on phones/tablets | Not available in the mobile webview; reports offer *Save as HTML* (open it and print/share from there). |
| Database | The app stores its encrypted document in IndexedDB. The relational SQLite/SQLCipher schema (`db/`, `docs/DATABASE.md`) is designed and tested and is the planned next storage engine for the native apps; `tools/vaultbak_to_sqlite.py` already migrates backups into it. |
| Sync | Off. Planned as user-hosted sync (Phase 3); data moves between devices with encrypted backups until then. |

## Verified

- Browser: full end-to-end suite (`tests/run_all.py`) in Chromium, plus PWA offline start.
- Native Linux build, run on a virtual display: splash → setup → vault created → data persists
  after restart → unlock → report opened in the in-app viewer → saved through the OS dialog →
  printed to PDF (report only, no app screen).
- CI (`.github/workflows/native.yml`) builds every platform on GitHub's Windows, macOS and
  Linux runners and starts the Linux app as a smoke test.
