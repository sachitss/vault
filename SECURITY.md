# Security and privacy

## How your data is protected

| Layer | Implementation (version 0.9) |
|---|---|
| Encryption at rest | All records, photos and documents are encrypted with **AES-256-GCM** (fresh 96-bit nonce per write) before they are stored in the browser's IndexedDB. |
| Key handling | A random 256-bit data key encrypts the vault. It is wrapped with a key derived from your password using **PBKDF2-SHA-256, 600,000 iterations**, and exists unwrapped only in memory while the vault is unlocked. Changing the password re-wraps the key. |
| Unlock protection | After 5 wrong passwords, unlocking pauses for 30 s, doubling up to 1 h. Auto-lock after inactivity (default 5 min). |
| Confidential fields | Locker numbers, agreement and policy numbers, document numbers and ID references are shown masked (`******4821`); revealing requires the password and is written to the audit log. |
| No network | The app makes no network requests. A strict Content-Security-Policy blocks all outbound connections. The web app's service worker caches only the program files. |
| QR labels | Contain only the inventory ID (e.g. `JWL-2026-00001`) — no value, owner or location. |
| Backups | One file, encrypted with AES-256-GCM using the vault password or a separate backup password; decrypted and verified immediately after writing. |
| Evidence integrity | Every uploaded file gets a SHA-256 fingerprint recorded in the vault. |
| Audit trail | Changes, reveals, exports, backups and restores are logged inside the encrypted vault. |

## Important limits

- **The password cannot be recovered.** Without it (and without a backup whose password you know), the data cannot be decrypted by anyone, including the developer.
- **Browser storage can be cleared.** Clearing "cookies and site data", some cleanup tools, or iOS storage eviction delete the vault. Keep regular encrypted backups on another medium, and store them **away from the valuables** (not in the bank locker).
- **Exports and printed reports are not encrypted.** Confidential fields are masked unless you explicitly include them. Store exports on an encrypted drive and delete them when done.
- **A compromised device is out of scope.** Malware or a person with access to your unlocked computer can read what you can read. Lock the vault (or let it auto-lock) when you step away.
- **Shared browser profile.** In Chromium browsers, local HTML files share one storage origin. Another local HTML file you open could read the *encrypted* vault records, but not decrypt them.
- **Prototype.** Version 0.9 has not had an external security audit. Biometric unlock, PIN, hardware-backed keys and Argon2id are planned for a later version of the native apps.

## Privacy (GDPR)

- All processing happens locally on your device. No accounts, no analytics, no telemetry, no cookies.
- Personal data of other people (co-owners, beneficiaries, witnesses) is limited to what you enter — a name and relationship are usually enough.
- You can export (Import / Export) and erase (Settings → Erase vault) all data at any time.
- For private household use the GDPR household exemption applies. If the app is offered to others, a privacy notice, a record of processing activities and a data-protection impact assessment will be published here.

## Reporting a vulnerability

Please e-mail **support@medtec24.com** with "Security" in the subject. Do not open a public issue for security problems. You will receive a reply within 7 days.

Powered by © Ing.-Büro Sachit Shrestha
