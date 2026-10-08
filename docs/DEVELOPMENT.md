# Development

## Layout

```
db/             relational schema (schema.sql), reference data, sample vault, reporting queries — see DATABASE.md
src/            app source: platform.js (browser vs native: save, print, links, QR scan), core.js (crypto, storage, valuation, scoring, insurance), ui.js + views2.js (screens),
                data.js (import/export, reports, backup, sample data, boot), app.css, splash.html, schema.json
assets/         icon.svg, generated icons (assets/icons), brand logo
samples/        sample PDFs embedded in the demo data
templates/      Excel/CSV import templates and sample inventory
tools/          build.py, package.py, vaultbak_to_sqlite.py, make_icons.py, make_templates.py, make_sample_pdfs.py, requirements.txt
src-tauri/      native shell (Tauri 2, Rust): tauri.conf.json, capabilities/, icons/, src/lib.rs — see ARCHITECTURE.md
install/        windows/ (install.bat, install.ps1, uninstall.ps1), macos/ (*.command), linux/ (*.sh)
tests/          Playwright browser tests (run_all.py runs them all)
dist/           valuables-vault.html is committed (installers in the repo use it); dist/pwa, dist/app (native frontend) and dist/release are build output
.github/        CI, release, native-app and GitHub Pages workflows
```

`src/schema.json` defines categories, field groups and the 92 import/export columns. The app, the templates and the tests all read it — change fields there.

## Build and test

```bash
npm ci
pip install -r tools/requirements.txt && python -m playwright install chromium
python3 tools/build.py        # dist/valuables-vault.html + dist/pwa/
python3 tests/run_all.py      # database schema + queries, app end-to-end, backup migration, import, splash, PWA offline
python3 tools/package.py      # dist/release/ installers + SHA256SUMS.txt
```

The build is deterministic. **Commit `dist/valuables-vault.html` after every source change** — CI fails if it differs from a fresh build.

Regenerate assets only when their sources change: `python3 tools/make_icons.py` (after editing `assets/icon.svg`), `python3 tools/make_templates.py` (after changing `schema.json`), `python3 tools/make_sample_pdfs.py`.

## Releasing

1. Set `"version"` in `package.json`, add a section to `CHANGELOG.md`, run the build and commit.
2. Either `git tag v0.9.1 && git push origin v0.9.1`, or on GitHub: *Releases → Draft a new release*, new tag `v0.9.1`, *Publish*.
3. The *Release* workflow builds, tests, packages and attaches the script installers, the standalone file and `SHA256SUMS.txt` (a few minutes).
4. When the release is **published on GitHub**, the *Native apps* workflow also builds and attaches the Windows, macOS, Linux and Android installers (about 30 minutes). It can be re-run any time: *Actions → Native apps → Run workflow* (optionally with the release tag to attach to).

## Web app (GitHub Pages)

The *Web app* workflow publishes `dist/pwa/` to `https://sachitss.github.io/vault/` on every push to `main` that touches the app. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The service worker caches only the program files. Vault data stays encrypted in the device's IndexedDB.

## Native apps (Tauri 2)

Requirements: [Rust](https://rustup.rs) (stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev patchelf`; Windows: WebView2 + MSVC build tools; macOS: Xcode command-line tools).

```bash
python3 tools/build.py            # always first: the native app embeds dist/app/
npx tauri dev                     # run the native app (no hot reload: rebuild with build.py)
npx tauri build                   # installers for this OS → src-tauri/target/release/bundle/
npx tauri android init && npx tauri android build --apk   # needs Android SDK + NDK, Java 17
```

`src-tauri/gen/` (generated Android/iOS projects) is not committed; CI recreates it. App icons come from `npx tauri icon assets/icons/icon-1024.png -o src-tauri/icons`.

Rules for the web code so it keeps working natively: save files through `download()` / `Platform.save()` (never `<a download>` alone on mobile), open reports with `openReport()`, and do not add network requests — the native CSP blocks them. New native features need a permission in `src-tauri/capabilities/`; grant the narrowest one.

Signing secrets and what happens without them are listed at the top of `.github/workflows/native.yml`. Google Play publishing (developer account, upload key, service account, store listing): **[GOOGLE_PLAY.md](GOOGLE_PLAY.md)**. For an Apple Developer *organisation* account, enrol with the D-U-N-S number `317353353`.

## Script installers

All script installers are per user and need no admin rights. They look for `valuables-vault.html` next to themselves (release archive) or in `../../dist/` (repository checkout), so they also work from a cloned repo:

```bash
install/linux/install.sh                    # Linux
bash install/macos/install.command          # macOS
install\windows\install.bat                 # Windows
```

Test switches: `VV_NO_LAUNCH=1`, `VV_HOME=…` (Linux), `VV_APPS_DIR=…` (macOS), `VV_YES=1` (uninstall without prompt), `VV_DRY_RUN=1` (launcher prints the command); Windows: `install.ps1 -WhatIf -NoLaunch`.

Code signing (Authenticode for Windows, Developer ID + notarisation for macOS, Android release key, Apple for iOS) is supported by the native workflow but needs the certificates as repository secrets; until then users see a SmartScreen / Gatekeeper prompt on first run.
