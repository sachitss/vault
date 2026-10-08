# User manual

## First start

1. **Create the vault.** Enter your name (shown in reports and the audit log) and a long passphrase (at least 12 characters). Store the passphrase in a password manager or sealed with your estate papers — it cannot be reset.
2. Leave **Load sample data** ticked to explore with five example items, including `JWL-2026-00001`, a fully documented gold necklace. Remove them later in **Settings → Remove sample data**.

## Setting up

| Where | What to enter |
|---|---|
| **Settings** | Base currency (e.g. EUR) and exchange rates for other currencies you use (e.g. NPR). Thresholds for outdated valuations, renewal warnings and backup reminders. |
| **Owners & people** | Family members, co-owners, beneficiaries, locker holders, witnesses. A name and relationship is enough. |
| **Locations** | Home, safes (tick *certified security safe* if it is one, e.g. EN 1143-1), bank lockers with bank, branch, locker number (stored encrypted, shown masked), holders, the bank's cover and the next review date. |
| **Insurance** | Each policy with sum insured and the limits from the policy schedule: valuables limit (% of sum insured), limit outside a certified safe, jewellery, gold, art, per-item and bank-locker limits, and covered perils. |

## Adding valuables

**Add item** asks the questions an insurer asks: *What is it? · When and where was it acquired and what did it cost? · Who owns it? · Where is it stored and how is it insured?* Fields specific to the category appear automatically. For gold, entering the purity (e.g. 750) fills the karat and shows the fine-gold content.

After saving, add on the item page:

- **Photos** — front, rear, detail, hallmark, serial number, certificate, storage location. On a phone you can take them with the camera.
- **Documents** — purchase invoice, certificate (GIA, assay …), appraisal, insurance documents.
- **Valuations** — market value (what it would sell for) and insurance/replacement value (what an equivalent costs new) as separate, dated entries.
- **Verification** — a witness confirms the item; they can sign on screen.

The **documentation score** on each item shows what is still missing for a claim.

Many items at once: fill `templates/valuables-import-template.xlsx` and use **Import / Export → Import**.

## Everyday use

- **Dashboard** — totals, values by category and location, and alerts (renewal due, valuation outdated, missing invoice/photo/certificate, uninsured items, backup due). Click an alert to see the affected items.
- **Inventory** — search by ID, name, serial or certificate number; filter by owner, location, category, value, date and insurance status.
- **Scan QR** — print QR labels (Reports → QR labels) for pouches and boxes; scanning opens the record after unlocking.
- **Lock** — locks immediately; the vault also locks itself after the inactivity time set in Settings.

## Reports

**Reports** creates print-ready pages (Print → *Save as PDF*): personal inventory, photo inventory, insurance, bank locker (with a *present ✓* column and signature lines for your next visit), estate & inheritance, verification, missing information and QR labels. Each item also has an **Evidence sheet** with all photos, documents, valuations and verifications — the document to send to an insurer after a loss.

## Backups

**Backup → Create & verify backup** writes one encrypted `.vaultbak` file with everything. Choose **separate backup password** for a copy that your executor can open without knowing the vault password. Keep backups on an external drive and somewhere other than where the valuables are. **Restore** shows what a backup contains before replacing anything.

## Insurance check — how to read it

- **Under-insured**: the covered items exceed the sum insured or one of its sub-limits. The finding names the limit and the gap.
- **Adequately insured**: all checks pass.
- **Potentially over-insured**: the sum insured is far above the listed items (only meaningful for valuables-only policies; a household policy also covers furniture, clothes, electronics …).

This is an indication based on the figures you entered. Your policy wording decides.

---
Questions: support@medtec24.com · Powered by © Ing.-Büro Sachit Shrestha
