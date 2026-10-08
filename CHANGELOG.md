# Changelog

## 0.9.0 — 2026-10-08

First release: a working prototype for all platforms.

- Encrypted offline inventory (AES-256-GCM, PBKDF2 600k) with category-specific details, inventory IDs `CAT-YYYY-NNNNN`, owners, co-owners and beneficiaries.
- Photos and documents stored encrypted with capture date, EXIF and SHA-256 fingerprint; preview for images and PDF.
- Valuation history (purchase, market, replacement, insurance, appraised, estimated) with chart and outdated alerts; gold fine-weight and metal-value helper.
- Insurance analysis: sum insured, valuables sub-limit, outside-safe, category, per-item and bank-locker limits; renewal alerts.
- Storage locations with certified-safe flag and bank lockers (masked locker numbers, bank cover, inspections).
- Witness verification with on-screen signature.
- Reports: inventory, photo, insurance, bank locker, estate, verification, missing information, QR labels, item evidence sheet.
- CSV / Excel import (mapping, EU number and date formats, validation, duplicate handling, error report) and 9-sheet Excel export; import templates.
- Documentation completeness score and dashboard alerts.
- Audit log, recycle bin, encrypted and verified backup / restore.
- Animated vault splash screen; Powered-by branding.
- **Native apps** from the same code base (Tauri 2): Windows `.msi` / setup `.exe`, macOS universal `.dmg`, Linux `.deb` / `.rpm` / `.AppImage`, Android `.apk` / `.aab` for phones and tablets (target API 36); iOS/iPadOS unsigned `.ipa` for sideloading, App Store build ready for Apple signing. Vault kept in private app storage, native save dialogs, in-app report viewer with print, camera QR scanning on mobile, single instance on desktop. See `docs/ARCHITECTURE.md`.
- Installable web app (PWA) for Chrome, Edge, Firefox and Safari, including iPhone and iPad, with offline start.
- Script installers for Windows, macOS and Linux (own browser app window, per user) and a standalone single-file version.
- Relational database design for the native app: SQLite/SQLCipher schema with users and permissions, persons/owners, inventory items, categories, jewellery, gemstone and artwork details, purchase and valuation records, insurance policies, storage locations and bank lockers, documents, photographs, witnesses and verification records, beneficiaries, audit logs and backups (`db/`).
- Integrity rules in the database (ownership shares, category values, masked confidential numbers, append-only hash-chained audit log, soft delete) and views for values, documentation score, policy coverage and locker contents.
- `tools/vaultbak_to_sqlite.py`: migrates an app backup into the schema; database, query and migration tests in CI.
