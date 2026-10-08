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
- Installers for Windows, macOS and Linux (own app window, per user); installable web app (PWA) for Android, iPhone and iPad with offline start.
