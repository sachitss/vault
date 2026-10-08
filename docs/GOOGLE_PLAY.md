# Publishing on Google Play

## Developer account

| | |
|---|---|
| Google Play Console developer account ID | `6218422303113506130` |
| Console | https://play.google.com/console/u/0/developers/6218422303113506130 |
| D-U-N-S number (organisation verification; also needed for an Apple Developer organisation account) | `317353353` |
| Developer / publisher | Ing.-Büro Sachit Shrestha · support@medtec24.com |
| App package name (fixed forever once uploaded) | `com.medtec24.valuablesvault` |
| Privacy policy URL | https://sachitss.github.io/vault/privacy.html |

## One-time setup (about an hour, in this order)

1. **Create the app** in Play Console → *Create app*: name *Valuables Vault*, default language English (United States) — add German later under *Store presence → Translations* — App, Free, accept the declarations.
2. **Create the upload key** on your own computer (Java's `keytool`, installed with any JDK) and keep the file and passwords somewhere safe — losing them means asking Google to reset the upload key:
   ```bash
   keytool -genkeypair -v -keystore valuables-vault-upload.jks -alias upload \
     -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Ing.-Buero Sachit Shrestha"
   base64 -w0 valuables-vault-upload.jks > upload.b64     # macOS: base64 -i valuables-vault-upload.jks -o upload.b64
   ```
3. **Add the GitHub secrets** (repo → *Settings → Secrets and variables → Actions*):
   `ANDROID_KEYSTORE_BASE64` (contents of `upload.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`), `ANDROID_KEY_PASSWORD`.
   From then on every APK and App Bundle is signed with this key, and updates install over earlier versions.
4. **First upload by hand** (Google requires it before API uploads work): *Actions → Native apps → Run workflow*, download the `native-Android` artifact, then in Play Console → *Testing → Internal testing → Create new release* upload `Valuables-Vault_<version>_android.aab`. Accept **Play App Signing** when asked (Google keeps the app signing key; your key is only the upload key).
5. **Automatic uploads** — create a service account:
   Google Cloud console → *IAM & Admin → Service accounts* → create `play-publisher`, create a JSON key.
   Play Console → *Users and permissions → Invite new user* → the service account's e-mail → app *Valuables Vault* → permission *Release apps to testing tracks* (add *Release to production* later if wanted).
   Save the whole JSON as the GitHub secret `PLAY_SERVICE_ACCOUNT_JSON`.
   From then on, publishing a GitHub release uploads the App Bundle to the **internal testing** track as a **draft**; you review and roll it out in Play Console. For another track: *Actions → Native apps → Run workflow* with *play_track* `alpha`, `beta` or `production`.

Each upload needs a higher version: raise `"version"` in `package.json` (0.9.0 → 0.9.1 …) for every Play release. The version code is derived from it.

## Store listing (ready to paste)

**App name** (30): `Valuables Vault`

**Short description** (80): `Encrypted offline inventory for jewellery, gold, art, safes and bank lockers.`

**Full description:**

```
Valuables Vault documents everything of value — gold, jewellery, diamonds, watches, coins, art, important documents and the contents of your home safe or bank locker — in one encrypted record per item.

EVIDENCE FOR INSURANCE CLAIMS
• Photos, invoices, certificates and appraisals stored with each item, with date and fingerprint
• Purchase, market, replacement and insurance values kept separately, with valuation history
• Insurance check: compares your items with the sum insured and sub-limits (valuables limit, outside-safe limit, bank-locker cover) and shows gaps
• Documentation score: see at a glance what is still missing for a claim

SAFES AND BANK LOCKERS
• Storage locations and bank lockers with masked locker numbers
• Printable locker inventory with signature lines; witnessed inspections with on-screen signature
• QR labels that contain only the inventory number — no values, no personal data

FAMILY AND ESTATE
• Owners, co-owners and beneficiaries per item
• Estate / inheritance report and verification report

PRIVATE BY DESIGN
• Everything is encrypted on your device (AES-256). No account, no server, no tracking, no ads
• Works completely offline
• Encrypted backups you keep yourself; Excel/CSV import and export

Also available for Windows, macOS, Linux, iPhone/iPad (web app) and every modern browser.
Powered by Ing.-Büro Sachit Shrestha · support@medtec24.com
```

**Category:** Finance · **Tags:** Finance, Productivity · **Contact e-mail:** support@medtec24.com · **Website:** https://github.com/sachitss/vault

**Graphics needed:** app icon 512 × 512 (`assets/icons/icon-512.png`), feature graphic 1024 × 500, at least 2 phone screenshots, plus 7" and 10" tablet screenshots for the tablet listing.

## App content answers

| Section | Answer |
|---|---|
| Privacy policy | https://sachitss.github.io/vault/privacy.html |
| Ads | No ads |
| App access | All functionality available without login (the user creates a local vault password; no account) |
| Content rating (IARC questionnaire) | Category *Utility, Productivity, Communication or Other*; no violence, sexual content, gambling, user-generated content sharing or user communication → expected rating *Everyone / PEGI 3* |
| Target audience | 18 and over |
| News app | No |
| Data safety | **No data collected, no data shared.** The app processes data only on the device and transmits nothing. Encryption in transit: not applicable (no transmission). Users can delete data in the app (*Settings → Erase vault*) |
| Government app | No |
| Financial features | None of the listed features (the app records values; it does not provide banking, payments, loans or trading) |
| Health | No |

## Technical requirements (handled in CI)

- **Target API level 36 (Android 16)** — required by Google Play for new apps and updates since 31 August 2026; the workflow sets `targetSdk = 36` and fails if it cannot.
- Minimum Android 8.0 (API 26). App Bundle with arm64, armv7, x86 and x86_64 code.
- Camera permission is used only for item photos and QR scanning (declared by the barcode-scanner plugin).
