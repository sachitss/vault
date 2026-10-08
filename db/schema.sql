-- =====================================================================
--  Valuables Vault — relational database schema, version 1
--  Target: SQLite 3.37+ (STRICT tables), opened through SQLCipher 4
--          (AES-256 page encryption) in the native app.
--
--  Conventions
--  * Primary keys: TEXT UUIDs (v4/v7) — safe to create offline on several
--    devices and merge during sync. inventory_items.inventory_code is the
--    human-readable business key (e.g. JWL-2026-00001).
--  * Money: INTEGER minor units (cents, paisa) + ISO-4217 currency code.
--    Never REAL. currencies.minor_unit gives the decimals.
--  * Dates: TEXT 'YYYY-MM-DD'; timestamps: TEXT ISO-8601 UTC
--    ('YYYY-MM-DDTHH:MM:SS.sssZ').
--  * Confidential values (locker, policy, agreement, ID numbers) are
--    stored a second time field-encrypted (*_enc BLOB, AES-256-GCM with
--    the vault key) plus *_last4 for masked display (******4821).
--  * Photos and documents: encrypted blobs outside the database file,
--    referenced by blob_ref; the SHA-256 of the plaintext proves integrity.
--  * Soft delete (deleted_at) for user data; audit_logs is append-only and
--    hash-chained.
--  * Every table carries created_at / updated_at (and updated_by_device)
--    for field-level sync merges.
-- =====================================================================

PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

-- ---------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------
CREATE TABLE currencies (
    code            TEXT PRIMARY KEY CHECK (length(code) = 3 AND code = upper(code)),
    name            TEXT NOT NULL,
    minor_unit      INTEGER NOT NULL DEFAULT 2 CHECK (minor_unit BETWEEN 0 AND 3),
    scale           REAL GENERATED ALWAYS AS (CASE minor_unit WHEN 0 THEN 1.0 WHEN 1 THEN 10.0 WHEN 2 THEN 100.0 ELSE 1000.0 END) VIRTUAL
) STRICT;

CREATE TABLE fx_rates (
    currency_code   TEXT NOT NULL REFERENCES currencies(code),
    base_code       TEXT NOT NULL REFERENCES currencies(code),
    rate            REAL NOT NULL CHECK (rate > 0),          -- 1 unit of currency = rate units of base
    as_of           TEXT NOT NULL CHECK (date(as_of) IS as_of),
    source          TEXT,                                     -- e.g. ECB, Nepal Rastra Bank, manual
    PRIMARY KEY (currency_code, base_code, as_of)
) STRICT;

CREATE TABLE categories (
    code            TEXT PRIMARY KEY CHECK (length(code) = 3 AND code = upper(code)),
    name            TEXT NOT NULL UNIQUE,
    parent_code     TEXT REFERENCES categories(code),
    detail_kind     TEXT NOT NULL CHECK (detail_kind IN ('jewellery','gemstone','artwork','attributes')),
    cert_expected   INTEGER NOT NULL DEFAULT 0 CHECK (cert_expected IN (0,1)),
    counts_as_valuables INTEGER NOT NULL DEFAULT 1 CHECK (counts_as_valuables IN (0,1)), -- for policy sub-limits
    sort_order      INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;

-- ---------------------------------------------------------------------
-- People and users
-- ---------------------------------------------------------------------
-- Everyone the vault refers to: owners, co-owners, beneficiaries,
-- locker holders, policyholders, witnesses. Keep it minimal (GDPR).
CREATE TABLE persons (
    id              TEXT PRIMARY KEY,
    full_name       TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
    relationship    TEXT,                                     -- to the vault owner: self, spouse, daughter, notary …
    email           TEXT,
    phone           TEXT,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_by_device TEXT,
    deleted_at      TEXT
) STRICT;

-- Accounts that can open the vault. Each user holds their own wrapped copy
-- of the data-encryption key (DEK).
CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name    TEXT NOT NULL,
    person_id       TEXT REFERENCES persons(id),
    role            TEXT NOT NULL CHECK (role IN ('administrator','owner','family_member','viewer','auditor')),
    kdf_algorithm   TEXT NOT NULL DEFAULT 'argon2id' CHECK (kdf_algorithm IN ('argon2id','pbkdf2-sha256')),
    kdf_params      TEXT NOT NULL CHECK (json_valid(kdf_params)),   -- {"m":65536,"t":3,"p":1,"salt":"…"}
    wrapped_dek     BLOB NOT NULL,                                  -- DEK encrypted with the password-derived key
    device_wrapped_dek BLOB,                                        -- optional: wrapped by OS keystore for biometric/PIN unlock
    totp_secret_enc BLOB,                                           -- optional second factor
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until    TEXT,
    valid_from      TEXT,
    valid_until     TEXT,                                           -- time-limited access (auditor / valuer)
    last_login_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    disabled_at     TEXT,
    CHECK (role <> 'auditor' OR valid_until IS NOT NULL)            -- auditors always expire
) STRICT;

-- Fine-grained access: which categories, items or locations a user may see/edit.
CREATE TABLE user_permissions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_type      TEXT NOT NULL CHECK (scope_type IN ('all','category','item','location')),
    scope_id        TEXT,                                           -- category code / item id / location id
    can_edit        INTEGER NOT NULL DEFAULT 0 CHECK (can_edit IN (0,1)),
    can_reveal_confidential INTEGER NOT NULL DEFAULT 0 CHECK (can_reveal_confidential IN (0,1)),
    expires_at      TEXT,
    CHECK ((scope_type = 'all') = (scope_id IS NULL)),
    UNIQUE (user_id, scope_type, scope_id)
) STRICT;

-- ---------------------------------------------------------------------
-- Storage locations and bank lockers
-- ---------------------------------------------------------------------
CREATE TABLE storage_locations (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    location_type   TEXT NOT NULL CHECK (location_type IN ('home','home_safe','office_safe','bank_locker','family_member','other_secure')),
    parent_id       TEXT REFERENCES storage_locations(id),         -- e.g. a safe inside "Home"
    address         TEXT,
    country_code    TEXT CHECK (country_code IS NULL OR length(country_code) = 2),
    safe_certified  INTEGER NOT NULL DEFAULT 0 CHECK (safe_certified IN (0,1)),
    safe_standard   TEXT,                                          -- e.g. EN 1143-1
    safe_grade      TEXT,                                          -- e.g. Grade I
    safe_weight_kg  REAL CHECK (safe_weight_kg IS NULL OR safe_weight_kg > 0),
    custodian_person_id TEXT REFERENCES persons(id),               -- for 'family_member'
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_by_device TEXT,
    deleted_at      TEXT,
    CHECK (safe_certified = 0 OR location_type IN ('home_safe','office_safe'))
) STRICT;

-- 1:1 extension of a storage location of type 'bank_locker'.
CREATE TABLE bank_lockers (
    location_id     TEXT PRIMARY KEY REFERENCES storage_locations(id) ON DELETE CASCADE,
    bank_name       TEXT NOT NULL,
    branch          TEXT,
    country_code    TEXT CHECK (country_code IS NULL OR length(country_code) = 2),
    locker_number_enc   BLOB,
    locker_number_last4 TEXT CHECK (locker_number_last4 IS NULL OR length(locker_number_last4) <= 4),
    locker_type     TEXT,                                          -- size class
    agreement_ref_enc   BLOB,
    agreement_ref_last4 TEXT,
    agreement_date  TEXT,
    access_authority TEXT,                                         -- joint / either-or-survivor / with nominee …
    annual_rent_minor INTEGER CHECK (annual_rent_minor IS NULL OR annual_rent_minor >= 0),
    bank_cover_minor  INTEGER CHECK (bank_cover_minor IS NULL OR bank_cover_minor >= 0), -- cover provided by the bank
    currency_code   TEXT REFERENCES currencies(code),
    liability_terms TEXT,                                          -- wording from the locker agreement
    last_inspection_on TEXT CHECK (last_inspection_on IS NULL OR date(last_inspection_on) IS last_inspection_on),
    next_review_on  TEXT CHECK (next_review_on IS NULL OR date(next_review_on) IS next_review_on),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK ((annual_rent_minor IS NULL AND bank_cover_minor IS NULL) OR currency_code IS NOT NULL)
) STRICT;

CREATE TABLE bank_locker_holders (
    location_id     TEXT NOT NULL REFERENCES bank_lockers(location_id) ON DELETE CASCADE,
    person_id       TEXT NOT NULL REFERENCES persons(id),
    holder_role     TEXT NOT NULL DEFAULT 'holder' CHECK (holder_role IN ('holder','joint_holder','nominee','authorised')),
    PRIMARY KEY (location_id, person_id)
) STRICT;

-- ---------------------------------------------------------------------
-- Inventory items and category details
-- ---------------------------------------------------------------------
CREATE TABLE inventory_items (
    id              TEXT PRIMARY KEY,
    inventory_code  TEXT NOT NULL UNIQUE
                    CHECK (inventory_code GLOB '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'),
    category_code   TEXT NOT NULL REFERENCES categories(code),
    subcategory     TEXT,
    name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description     TEXT,
    brand           TEXT,
    manufacturer    TEXT,
    model           TEXT,
    serial_number   TEXT,
    identification_number TEXT,
    barcode         TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','sold','gifted','lost','stolen','damaged','deleted')),
    status_changed_on TEXT,
    location_id     TEXT REFERENCES storage_locations(id),
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_by      TEXT REFERENCES users(id),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_by_device TEXT,
    deleted_at      TEXT,
    CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX ux_items_serial ON inventory_items(category_code, serial_number)
    WHERE serial_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_items_location ON inventory_items(location_id);
CREATE INDEX ix_items_category ON inventory_items(category_code);

-- Gold, precious metal and jewellery attributes (also used by bullion, coins, watches).
CREATE TABLE jewellery_details (
    item_id         TEXT PRIMARY KEY REFERENCES inventory_items(id) ON DELETE CASCADE,
    jewellery_type  TEXT,                                          -- necklace, ring, bangle, bar, coin …
    metal_type      TEXT CHECK (metal_type IN ('gold','silver','platinum','palladium','steel','titanium','mixed','other')),
    metal_colour    TEXT CHECK (metal_colour IN ('yellow','white','rose','two_tone','fine')),
    purity_permille INTEGER CHECK (purity_permille BETWEEN 1 AND 1000),   -- 750 = 18K
    karat           REAL GENERATED ALWAYS AS (round(purity_permille * 24.0 / 1000, 1)) VIRTUAL,
    gross_weight_g  REAL CHECK (gross_weight_g IS NULL OR gross_weight_g > 0),
    net_metal_weight_g REAL CHECK (net_metal_weight_g IS NULL OR net_metal_weight_g > 0),
    fine_weight_g   REAL GENERATED ALWAYS AS (net_metal_weight_g * purity_permille / 1000.0) VIRTUAL,
    hallmark        TEXT,
    assay_certificate_no TEXT,
    metal_price_per_g_at_purchase_minor INTEGER,
    metal_price_currency TEXT REFERENCES currencies(code),
    length_mm       REAL,
    size            TEXT,                                          -- ring size, chain length …
    CHECK (net_metal_weight_g IS NULL OR gross_weight_g IS NULL OR net_metal_weight_g <= gross_weight_g)
) STRICT;

-- One row per stone or stone group; an item can hold several.
CREATE TABLE gemstone_details (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    gem_type        TEXT NOT NULL,                                 -- diamond, ruby, sapphire, emerald, pearl …
    is_centre_stone INTEGER NOT NULL DEFAULT 0 CHECK (is_centre_stone IN (0,1)),
    stone_count     INTEGER NOT NULL DEFAULT 1 CHECK (stone_count > 0),
    carat_total     REAL CHECK (carat_total IS NULL OR carat_total > 0),
    shape           TEXT,
    cut_grade       TEXT CHECK (cut_grade IS NULL OR cut_grade IN ('excellent','very_good','good','fair','poor')),
    colour_grade    TEXT,                                          -- D–Z or descriptive
    clarity_grade   TEXT CHECK (clarity_grade IS NULL OR clarity_grade IN ('FL','IF','VVS1','VVS2','VS1','VS2','SI1','SI2','I1','I2','I3')),
    fluorescence    TEXT CHECK (fluorescence IS NULL OR fluorescence IN ('none','faint','medium','strong','very_strong')),
    certification_authority TEXT,                                  -- GIA, IGI, HRD, AGS …
    certificate_number TEXT,
    laser_inscription TEXT,
    length_mm       REAL, width_mm REAL, depth_mm REAL,
    treatment       TEXT
) STRICT;
CREATE INDEX ix_gem_item ON gemstone_details(item_id);
CREATE INDEX ix_gem_cert ON gemstone_details(certificate_number) WHERE certificate_number IS NOT NULL;

CREATE TABLE artwork_details (
    item_id         TEXT PRIMARY KEY REFERENCES inventory_items(id) ON DELETE CASCADE,
    artist          TEXT,
    title           TEXT,
    creation_year   TEXT,                                          -- '1921', 'c. 1890', '1960s'
    medium          TEXT,
    width_cm        REAL, height_cm REAL, depth_cm REAL,
    signature       TEXT CHECK (signature IS NULL OR signature IN ('front','back','front_and_back','monogram','unsigned')),
    edition_number  INTEGER CHECK (edition_number IS NULL OR edition_number > 0),
    edition_size    INTEGER CHECK (edition_size IS NULL OR edition_size > 0),
    provenance      TEXT,
    previous_owners TEXT,
    gallery_dealer  TEXT,
    artist_certificate_no TEXT,
    authenticity_certificate_no TEXT,
    restoration_history TEXT,
    CHECK (edition_number IS NULL OR edition_size IS NULL OR edition_number <= edition_size)
) STRICT;

-- Attributes for watches, coins, antiques, electronics, documents
-- (key/value, validated by the app against src/schema.json).
CREATE TABLE item_attributes (
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    attr_group      TEXT NOT NULL CHECK (attr_group IN ('watch','coin','antique','electronics','document','dimensions')),
    attr_key        TEXT NOT NULL,
    attr_value      TEXT,
    is_confidential INTEGER NOT NULL DEFAULT 0 CHECK (is_confidential IN (0,1)),
    PRIMARY KEY (item_id, attr_group, attr_key)
) STRICT;

-- ---------------------------------------------------------------------
-- Acquisition, ownership, beneficiaries
-- ---------------------------------------------------------------------
CREATE TABLE purchase_records (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    acquisition_method TEXT NOT NULL CHECK (acquisition_method IN ('purchased','inherited','gift','family_property','other')),
    acquired_on     TEXT CHECK (acquired_on IS NULL OR date(acquired_on) IS acquired_on),
    purchase_date   TEXT CHECK (purchase_date IS NULL OR date(purchase_date) IS purchase_date),
    seller          TEXT,
    purchase_location TEXT,
    country_code    TEXT CHECK (country_code IS NULL OR length(country_code) = 2),
    invoice_number  TEXT,
    price_minor     INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
    currency_code   TEXT REFERENCES currencies(code),
    payment_method  TEXT,
    from_person_id  TEXT REFERENCES persons(id),                    -- inherited from / gift from
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (price_minor IS NULL OR currency_code IS NOT NULL),
    CHECK (acquisition_method <> 'purchased' OR price_minor IS NOT NULL OR purchase_date IS NOT NULL OR invoice_number IS NOT NULL)
) STRICT;
CREATE INDEX ix_purchase_item ON purchase_records(item_id);

-- Ownership (with history: ended_on set when ownership changes).
CREATE TABLE owners (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    person_id       TEXT NOT NULL REFERENCES persons(id),
    ownership_type  TEXT NOT NULL DEFAULT 'sole' CHECK (ownership_type IN ('sole','joint','family','trust','other')),
    share_pct       REAL NOT NULL DEFAULT 100 CHECK (share_pct > 0 AND share_pct <= 100),
    is_primary      INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
    started_on      TEXT,
    ended_on        TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
) STRICT;
CREATE INDEX ix_owners_item ON owners(item_id) WHERE ended_on IS NULL;
CREATE INDEX ix_owners_person ON owners(person_id) WHERE ended_on IS NULL;
CREATE UNIQUE INDEX ux_owners_primary ON owners(item_id) WHERE is_primary = 1 AND ended_on IS NULL;

CREATE TABLE beneficiaries (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    person_id       TEXT NOT NULL REFERENCES persons(id),
    share_pct       REAL CHECK (share_pct IS NULL OR (share_pct > 0 AND share_pct <= 100)),
    condition_note  TEXT,                                          -- intention only; a will governs
    designated_on   TEXT,
    revoked_on      TEXT,
    UNIQUE (item_id, person_id, designated_on)
) STRICT;

-- ---------------------------------------------------------------------
-- Valuations and insurance
-- ---------------------------------------------------------------------
CREATE TABLE valuation_records (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    valuation_type  TEXT NOT NULL CHECK (valuation_type IN ('purchase','market','replacement','insurance','appraised','estimated')),
    value_minor     INTEGER NOT NULL CHECK (value_minor >= 0),
    currency_code   TEXT NOT NULL REFERENCES currencies(code),
    valued_on       TEXT NOT NULL CHECK (date(valued_on) IS valued_on),
    valid_until     TEXT CHECK (valid_until IS NULL OR valid_until >= valued_on),
    source          TEXT CHECK (source IS NULL OR source IN ('invoice','professional_valuer','insurance_appraisal','dealer_quote','metal_spot_price','auction_result','owner_estimate','import','other')),
    valuer_name     TEXT,
    valuer_organisation TEXT,
    document_id     TEXT REFERENCES documents(id),
    metal_price_per_g_minor INTEGER,                               -- when derived from the gold price
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_by      TEXT REFERENCES users(id)
) STRICT;
CREATE INDEX ix_val_item ON valuation_records(item_id, valuation_type, valued_on);

CREATE TABLE insurance_policies (
    id              TEXT PRIMARY KEY,
    insurer         TEXT NOT NULL,
    policy_number_enc   BLOB,
    policy_number_last4 TEXT,
    policyholder_person_id TEXT REFERENCES persons(id),
    policy_type     TEXT NOT NULL CHECK (policy_type IN ('household_contents','valuables_all_risk','bank_locker','art_collection','other')),
    coverage_minor  INTEGER NOT NULL CHECK (coverage_minor >= 0),  -- sum insured
    currency_code   TEXT NOT NULL REFERENCES currencies(code),
    start_date      TEXT CHECK (start_date IS NULL OR date(start_date) IS start_date),
    renewal_date    TEXT CHECK (renewal_date IS NULL OR date(renewal_date) IS renewal_date),
    deductible_minor INTEGER CHECK (deductible_minor IS NULL OR deductible_minor >= 0),
    valuables_limit_pct REAL CHECK (valuables_limit_pct IS NULL OR valuables_limit_pct BETWEEN 0 AND 100),
    outside_safe_limit_minor INTEGER,
    jewellery_limit_minor INTEGER,
    gold_limit_minor INTEGER,
    art_limit_minor  INTEGER,
    per_item_limit_minor INTEGER,
    locker_limit_minor INTEGER,
    covers_theft    INTEGER NOT NULL DEFAULT 1 CHECK (covers_theft IN (0,1)),
    covers_fire     INTEGER NOT NULL DEFAULT 1 CHECK (covers_fire IN (0,1)),
    covers_water    INTEGER NOT NULL DEFAULT 1 CHECK (covers_water IN (0,1)),
    covers_natural_hazards INTEGER NOT NULL DEFAULT 0 CHECK (covers_natural_hazards IN (0,1)),
    covers_worldwide INTEGER NOT NULL DEFAULT 0 CHECK (covers_worldwide IN (0,1)),
    covers_bank_locker INTEGER NOT NULL DEFAULT 0 CHECK (covers_bank_locker IN (0,1)),
    documentation_requirements TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_by_device TEXT,
    CHECK (renewal_date IS NULL OR start_date IS NULL OR renewal_date > start_date),
    CHECK (locker_limit_minor IS NULL OR covers_bank_locker = 1)
) STRICT;

-- Which items a policy covers (individually scheduled, optionally with an agreed sum) …
CREATE TABLE policy_items (
    policy_id       TEXT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    scheduled_sum_minor INTEGER CHECK (scheduled_sum_minor IS NULL OR scheduled_sum_minor >= 0),
    PRIMARY KEY (policy_id, item_id)
) STRICT;
-- … and which locations it covers as a whole (e.g. a locker policy).
CREATE TABLE policy_locations (
    policy_id       TEXT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    location_id     TEXT NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, location_id)
) STRICT;
CREATE TABLE policy_categories (
    policy_id       TEXT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    category_code   TEXT NOT NULL REFERENCES categories(code),
    PRIMARY KEY (policy_id, category_code)
) STRICT;

-- ---------------------------------------------------------------------
-- Evidence: documents and photographs
-- ---------------------------------------------------------------------
CREATE TABLE documents (
    id              TEXT PRIMARY KEY,
    -- exactly one owner record:
    item_id         TEXT REFERENCES inventory_items(id) ON DELETE CASCADE,
    policy_id       TEXT REFERENCES insurance_policies(id) ON DELETE CASCADE,
    location_id     TEXT REFERENCES storage_locations(id) ON DELETE CASCADE,
    verification_id TEXT REFERENCES verification_records(id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL CHECK (document_type IN ('purchase_invoice','receipt','bank_statement','certificate','appraisal',
                        'insurance_document','warranty','ownership_document','authenticity_certificate','import_export',
                        'restoration','locker_agreement','signed_verification','will_or_estate','other')),
    title           TEXT,
    reference_number TEXT,
    issued_on       TEXT CHECK (issued_on IS NULL OR date(issued_on) IS issued_on),
    file_name       TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
    sha256          TEXT NOT NULL CHECK (length(sha256) = 64),
    blob_ref        TEXT NOT NULL UNIQUE,                           -- encrypted file in the blob store
    uploaded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    uploaded_by     TEXT REFERENCES users(id),
    deleted_at      TEXT,
    CHECK ((item_id IS NOT NULL) + (policy_id IS NOT NULL) + (location_id IS NOT NULL) + (verification_id IS NOT NULL) = 1)
) STRICT;
CREATE INDEX ix_docs_item ON documents(item_id, document_type) WHERE item_id IS NOT NULL;

CREATE TABLE photographs (
    id              TEXT PRIMARY KEY,
    item_id         TEXT REFERENCES inventory_items(id) ON DELETE CASCADE,
    location_id     TEXT REFERENCES storage_locations(id) ON DELETE CASCADE,
    view_type       TEXT NOT NULL CHECK (view_type IN ('front','rear','side','detail','serial_number','hallmark','certificate','packaging','storage_location','other')),
    caption         TEXT,
    photographer    TEXT,
    taken_at        TEXT,
    taken_at_source TEXT NOT NULL DEFAULT 'file' CHECK (taken_at_source IN ('exif','file','manual')),
    camera          TEXT,
    width_px        INTEGER, height_px INTEGER,
    exif_json       TEXT CHECK (exif_json IS NULL OR json_valid(exif_json)),
    file_name       TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
    sha256          TEXT NOT NULL CHECK (length(sha256) = 64),
    blob_ref        TEXT NOT NULL UNIQUE,
    thumbnail_enc   BLOB,                                           -- small encrypted preview
    sort_order      INTEGER NOT NULL DEFAULT 0,
    uploaded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    uploaded_by     TEXT REFERENCES users(id),
    deleted_at      TEXT,
    CHECK ((item_id IS NOT NULL) + (location_id IS NOT NULL) = 1)
) STRICT;
CREATE INDEX ix_photos_item ON photographs(item_id, sort_order) WHERE item_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Witnesses and verification
-- ---------------------------------------------------------------------
CREATE TABLE witnesses (
    id              TEXT PRIMARY KEY,
    person_id       TEXT REFERENCES persons(id),                    -- if also in persons
    full_name       TEXT NOT NULL,
    relationship    TEXT,                                          -- friend, notary, bank officer …
    is_independent  INTEGER NOT NULL DEFAULT 1 CHECK (is_independent IN (0,1)),  -- not an owner/beneficiary
    id_document_type TEXT,
    id_reference_enc   BLOB,
    id_reference_last4 TEXT,
    contact         TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;

CREATE TABLE verification_records (
    id              TEXT PRIMARY KEY,
    witness_id      TEXT NOT NULL REFERENCES witnesses(id),
    verification_type TEXT NOT NULL CHECK (verification_type IN ('inventory_witnessed','ownership_verified','photograph_verified','valuation_verified','locker_inspection_witnessed')),
    verified_on     TEXT NOT NULL CHECK (date(verified_on) IS verified_on),
    place           TEXT,
    location_id     TEXT REFERENCES storage_locations(id),
    comments        TEXT,
    signature_png_enc BLOB,                                        -- on-screen signature
    signed_on_paper INTEGER NOT NULL DEFAULT 0 CHECK (signed_on_paper IN (0,1)),
    recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    recorded_by     TEXT REFERENCES users(id),
    CHECK (verification_type <> 'locker_inspection_witnessed' OR location_id IS NOT NULL)
) STRICT;

CREATE TABLE verification_items (
    verification_id TEXT NOT NULL REFERENCES verification_records(id) ON DELETE CASCADE,
    item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    present         INTEGER NOT NULL DEFAULT 1 CHECK (present IN (0,1)),  -- for locker checks: item found?
    remark          TEXT,
    PRIMARY KEY (verification_id, item_id)
) STRICT;

-- ---------------------------------------------------------------------
-- Audit, backups, imports
-- ---------------------------------------------------------------------
-- Append-only, hash-chained: hash = SHA-256(prev_hash || canonical row).
-- The app computes the hashes; triggers below forbid UPDATE and DELETE.
CREATE TABLE audit_logs (
    seq             INTEGER PRIMARY KEY AUTOINCREMENT,
    id              TEXT NOT NULL UNIQUE,
    occurred_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    user_id         TEXT REFERENCES users(id),
    device_id       TEXT,
    action          TEXT NOT NULL CHECK (action IN ('created','edited','deleted','restored','purged','valuation_added','valuation_removed',
                        'owner_changed','location_changed','policy_changed','document_added','document_removed','photo_added',
                        'photo_removed','verification_recorded','confidential_revealed','export','report','backup','restore',
                        'import','login','login_failed','lock','password_changed','settings_changed','sync')),
    entity_type     TEXT NOT NULL,
    entity_id       TEXT,
    field           TEXT,
    old_value       TEXT,
    new_value       TEXT,
    prev_hash       TEXT,
    hash            TEXT
) STRICT;
CREATE INDEX ix_audit_entity ON audit_logs(entity_type, entity_id, seq);

CREATE TABLE backups (
    id              TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_by      TEXT REFERENCES users(id),
    file_name       TEXT NOT NULL,
    destination     TEXT,                                          -- local folder, external drive, NAS, cloud folder
    size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
    sha256          TEXT NOT NULL CHECK (length(sha256) = 64),
    item_count      INTEGER NOT NULL CHECK (item_count >= 0),
    file_count      INTEGER NOT NULL CHECK (file_count >= 0),
    schema_version  INTEGER NOT NULL,
    password_mode   TEXT NOT NULL CHECK (password_mode IN ('vault','separate')),
    is_automatic    INTEGER NOT NULL DEFAULT 0 CHECK (is_automatic IN (0,1)),
    verified        INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
    verified_at     TEXT,
    notes           TEXT,
    CHECK (verified = 0 OR verified_at IS NOT NULL)
) STRICT;

CREATE TABLE import_runs (
    id              TEXT PRIMARY KEY,
    started_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    user_id         TEXT REFERENCES users(id),
    file_name       TEXT NOT NULL,
    row_count       INTEGER NOT NULL DEFAULT 0,
    created_count   INTEGER NOT NULL DEFAULT 0,
    updated_count   INTEGER NOT NULL DEFAULT 0,
    skipped_count   INTEGER NOT NULL DEFAULT 0,
    error_count     INTEGER NOT NULL DEFAULT 0,
    report_json     TEXT CHECK (report_json IS NULL OR json_valid(report_json))
) STRICT;

-- =====================================================================
--  Triggers — integrity rules the CHECKs cannot express
-- =====================================================================
-- Item code prefix must match its category (JWL-… for JWL).
CREATE TRIGGER trg_item_code_prefix_ins BEFORE INSERT ON inventory_items
WHEN substr(NEW.inventory_code, 1, 3) <> NEW.category_code
BEGIN SELECT RAISE(ABORT, 'inventory_code prefix must equal category_code'); END;

-- Bank-locker details only for locations of type bank_locker.
CREATE TRIGGER trg_locker_type BEFORE INSERT ON bank_lockers
WHEN (SELECT location_type FROM storage_locations WHERE id = NEW.location_id) <> 'bank_locker'
BEGIN SELECT RAISE(ABORT, 'bank_lockers row requires a storage location of type bank_locker'); END;

-- Current ownership shares of an item may not exceed 100 %.
CREATE TRIGGER trg_owner_share_ins BEFORE INSERT ON owners
WHEN NEW.ended_on IS NULL AND
     (SELECT coalesce(sum(share_pct), 0) FROM owners WHERE item_id = NEW.item_id AND ended_on IS NULL) + NEW.share_pct > 100.0001
BEGIN SELECT RAISE(ABORT, 'ownership shares of an item exceed 100 %'); END;

CREATE TRIGGER trg_owner_share_upd BEFORE UPDATE OF share_pct, ended_on ON owners
WHEN NEW.ended_on IS NULL AND
     (SELECT coalesce(sum(share_pct), 0) FROM owners WHERE item_id = NEW.item_id AND ended_on IS NULL AND id <> NEW.id) + NEW.share_pct > 100.0001
BEGIN SELECT RAISE(ABORT, 'ownership shares of an item exceed 100 %'); END;

-- Beneficiary shares of an item may not exceed 100 %.
CREATE TRIGGER trg_benef_share_ins BEFORE INSERT ON beneficiaries
WHEN NEW.share_pct IS NOT NULL AND NEW.revoked_on IS NULL AND
     (SELECT coalesce(sum(share_pct), 0) FROM beneficiaries WHERE item_id = NEW.item_id AND revoked_on IS NULL) + NEW.share_pct > 100.0001
BEGIN SELECT RAISE(ABORT, 'beneficiary shares of an item exceed 100 %'); END;

-- Items are soft-deleted first; a hard delete (purge) is only allowed from the recycle bin.
CREATE TRIGGER trg_item_purge_guard BEFORE DELETE ON inventory_items
WHEN OLD.deleted_at IS NULL
BEGIN SELECT RAISE(ABORT, 'soft-delete the item (status = deleted) before purging it'); END;

-- Audit log is append-only.
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

-- updated_at maintenance
CREATE TRIGGER trg_items_touch AFTER UPDATE ON inventory_items
WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE inventory_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;
CREATE TRIGGER trg_persons_touch AFTER UPDATE ON persons
WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE persons SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;
CREATE TRIGGER trg_locations_touch AFTER UPDATE ON storage_locations
WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE storage_locations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;
CREATE TRIGGER trg_policies_touch AFTER UPDATE ON insurance_policies
WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE insurance_policies SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

-- =====================================================================
--  Views — the questions the app must answer for every item
-- =====================================================================
-- Value in the base currency (settings key 'base_currency'); NULL if no FX rate.
CREATE VIEW v_fx_latest AS
SELECT c.code AS currency_code,
       CASE WHEN c.code = (SELECT value FROM settings WHERE key = 'base_currency') THEN 1.0
            ELSE (SELECT r.rate FROM fx_rates r
                  WHERE r.currency_code = c.code AND r.base_code = (SELECT value FROM settings WHERE key = 'base_currency')
                  ORDER BY r.as_of DESC LIMIT 1) END AS rate,
       c.scale
FROM currencies c;

-- Purchase prices appear as valuation rows of type 'purchase' as well.
CREATE VIEW v_valuations_all AS
SELECT id, item_id, valuation_type, value_minor, currency_code, valued_on, source FROM valuation_records
UNION ALL
SELECT 'purchase-' || p.id, p.item_id, 'purchase', p.price_minor, p.currency_code,
       coalesce(p.purchase_date, p.acquired_on), 'invoice'
FROM purchase_records p
WHERE p.price_minor IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM valuation_records v WHERE v.item_id = p.item_id AND v.valuation_type = 'purchase');

CREATE VIEW v_item_values AS
WITH ranked AS (
    SELECT v.*,
           CASE WHEN valuation_type IN ('market','appraised','estimated') THEN 'current'
                WHEN valuation_type IN ('insurance','replacement') THEN 'insurance'
                ELSE 'purchase' END AS kind,
           row_number() OVER (PARTITION BY item_id,
                CASE WHEN valuation_type IN ('market','appraised','estimated') THEN 'current'
                     WHEN valuation_type IN ('insurance','replacement') THEN 'insurance' ELSE 'purchase' END
                ORDER BY valued_on DESC, id DESC) AS rn
    FROM v_valuations_all v
),
base AS (
    SELECT r.*, (r.value_minor / fx.scale) * fx.rate AS value_base
    FROM ranked r JOIN v_fx_latest fx ON fx.currency_code = r.currency_code
    WHERE r.rn = 1
)
SELECT i.id AS item_id, i.inventory_code, i.name, i.category_code,
       (SELECT value_base FROM base b WHERE b.item_id = i.id AND kind = 'purchase')  AS purchase_base,
       (SELECT value_base FROM base b WHERE b.item_id = i.id AND kind = 'current')   AS current_base,
       (SELECT valued_on  FROM base b WHERE b.item_id = i.id AND kind = 'current')   AS current_valued_on,
       (SELECT valuation_type FROM base b WHERE b.item_id = i.id AND kind = 'current') AS current_type,
       (SELECT value_base FROM base b WHERE b.item_id = i.id AND kind = 'insurance') AS insurance_base,
       -- exposure = what an insurer would be asked to pay
       coalesce((SELECT value_base FROM base b WHERE b.item_id = i.id AND kind = 'insurance'),
                (SELECT value_base FROM base b WHERE b.item_id = i.id AND kind = 'current'),
                (SELECT value_base FROM base b WHERE b.item_id = i.id AND kind = 'purchase'), 0) AS exposure_base
FROM inventory_items i
WHERE i.deleted_at IS NULL AND i.status = 'active';

-- Policies that apply to each item: scheduled items + covered locations.
CREATE VIEW v_item_policies AS
SELECT pi.item_id, pi.policy_id FROM policy_items pi
UNION
SELECT i.id, pl.policy_id FROM inventory_items i JOIN policy_locations pl ON pl.location_id = i.location_id;

-- Documentation completeness (same rules as the app: 100 points).
CREATE VIEW v_item_documentation AS
WITH f AS (
    SELECT i.id AS item_id, i.inventory_code, i.name, c.cert_expected,
        (i.description IS NOT NULL AND length(i.description) > 0)                                   AS has_description,
        EXISTS (SELECT 1 FROM owners o WHERE o.item_id = i.id AND o.ended_on IS NULL)              AS has_owner,
        (SELECT acquisition_method FROM purchase_records p WHERE p.item_id = i.id LIMIT 1)          AS acquisition,
        EXISTS (SELECT 1 FROM purchase_records p WHERE p.item_id = i.id AND p.price_minor IS NOT NULL) AS has_price,
        EXISTS (SELECT 1 FROM purchase_records p WHERE p.item_id = i.id AND coalesce(p.purchase_date, p.acquired_on) IS NOT NULL) AS has_date,
        EXISTS (SELECT 1 FROM documents d WHERE d.item_id = i.id AND d.deleted_at IS NULL
                AND d.document_type IN ('purchase_invoice','receipt','bank_statement'))             AS has_purchase_doc,
        EXISTS (SELECT 1 FROM documents d WHERE d.item_id = i.id AND d.deleted_at IS NULL
                AND d.document_type IN ('ownership_document','will_or_estate','other','certificate','appraisal')) AS has_ownership_doc,
        (SELECT count(*) FROM photographs p WHERE p.item_id = i.id AND p.deleted_at IS NULL)         AS photo_count,
        EXISTS (SELECT 1 FROM documents d WHERE d.item_id = i.id AND d.deleted_at IS NULL
                AND d.document_type IN ('certificate','authenticity_certificate','appraisal'))      AS has_cert_doc,
        (EXISTS (SELECT 1 FROM gemstone_details g WHERE g.item_id = i.id AND g.certificate_number IS NOT NULL)
         OR EXISTS (SELECT 1 FROM jewellery_details j WHERE j.item_id = i.id AND j.assay_certificate_no IS NOT NULL)
         OR EXISTS (SELECT 1 FROM artwork_details a WHERE a.item_id = i.id AND coalesce(a.authenticity_certificate_no, a.artist_certificate_no) IS NOT NULL)) AS has_cert_no,
        v.current_valued_on,
        CASE WHEN i.category_code IN ('GLD','COI') OR EXISTS (SELECT 1 FROM jewellery_details j WHERE j.item_id = i.id AND j.metal_type IN ('gold','platinum'))
             THEN coalesce((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'metal_max_age_months'), 12)
             ELSE coalesce((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'valuation_max_age_months'), 36) END AS max_age_months,
        EXISTS (SELECT 1 FROM v_item_policies p WHERE p.item_id = i.id)                             AS has_policy,
        EXISTS (SELECT 1 FROM valuation_records r WHERE r.item_id = i.id AND r.valuation_type IN ('insurance','replacement')) AS has_ins_value,
        (i.location_id IS NOT NULL)                                                                 AS has_location,
        EXISTS (SELECT 1 FROM verification_items vi WHERE vi.item_id = i.id)                        AS witnessed
    FROM inventory_items i
    JOIN categories c ON c.code = i.category_code
    LEFT JOIN v_item_values v ON v.item_id = i.id
    WHERE i.deleted_at IS NULL AND i.status = 'active'
),
s AS (
    SELECT f.*,
        4 + 3 + 3 * has_description                                             AS s_basic,
        7 * has_owner + 3 * (acquisition IS NOT NULL)                           AS s_owner,
        CASE WHEN coalesce(acquisition, 'purchased') = 'purchased'
             THEN 4 * has_price + 3 * has_date + 8 * has_purchase_doc
             ELSE 7 * has_date + 8 * has_ownership_doc END                      AS s_purchase,
        CASE WHEN photo_count >= 3 THEN 15 WHEN photo_count >= 1 THEN 10 ELSE 0 END AS s_photo,
        CASE WHEN cert_expected = 0 THEN 10 WHEN has_cert_doc THEN 10 WHEN has_cert_no THEN 5 ELSE 0 END AS s_cert,
        CASE WHEN current_valued_on IS NULL THEN 0
             WHEN julianday('now') - julianday(current_valued_on) > max_age_months * 30.44 THEN 7
             ELSE 15 END                                                        AS s_valuation,
        5 * has_policy + 5 * has_ins_value                                      AS s_insurance,
        10 * has_location                                                       AS s_location,
        5 * witnessed                                                           AS s_witness
    FROM f
)
SELECT item_id, inventory_code, name,
       s_basic + s_owner + s_purchase + s_photo + s_cert + s_valuation + s_insurance + s_location + s_witness AS score,
       rtrim(
         CASE WHEN NOT has_description THEN 'description; ' ELSE '' END ||
         CASE WHEN NOT has_owner THEN 'owner; ' ELSE '' END ||
         CASE WHEN coalesce(acquisition,'purchased') = 'purchased' AND NOT has_purchase_doc THEN 'invoice/receipt; ' ELSE '' END ||
         CASE WHEN photo_count = 0 THEN 'photograph; ' WHEN photo_count < 3 THEN 'more photographs; ' ELSE '' END ||
         CASE WHEN cert_expected AND NOT has_cert_doc THEN 'certificate/appraisal; ' ELSE '' END ||
         CASE WHEN s_valuation = 0 THEN 'valuation; ' WHEN s_valuation = 7 THEN 'valuation outdated; ' ELSE '' END ||
         CASE WHEN NOT has_policy THEN 'insurance policy; ' WHEN NOT has_ins_value THEN 'insurance value; ' ELSE '' END ||
         CASE WHEN NOT has_location THEN 'storage location; ' ELSE '' END ||
         CASE WHEN NOT witnessed THEN 'witness verification; ' ELSE '' END, '; ') AS missing
FROM s;

-- Policy check: covered value against sum insured and the valuables sub-limit.
CREATE VIEW v_policy_coverage AS
WITH cov AS (
    SELECT p.id AS policy_id, p.insurer, p.policy_type,
           (p.coverage_minor / fx.scale) * fx.rate AS coverage_base,
           p.valuables_limit_pct,
           (p.locker_limit_minor / fx.scale) * fx.rate AS locker_limit_base,
           p.renewal_date
    FROM insurance_policies p JOIN v_fx_latest fx ON fx.currency_code = p.currency_code
    WHERE p.status = 'active'
),
items AS (
    SELECT ip.policy_id, v.item_id, v.exposure_base, c.counts_as_valuables,
           (l.location_type = 'bank_locker') AS in_locker
    FROM v_item_policies ip
    JOIN v_item_values v ON v.item_id = ip.item_id
    JOIN inventory_items i ON i.id = v.item_id
    JOIN categories c ON c.code = i.category_code
    LEFT JOIN storage_locations l ON l.id = i.location_id
)
SELECT cov.policy_id, cov.insurer, cov.policy_type, cov.coverage_base,
       count(items.item_id)                                       AS item_count,
       coalesce(sum(items.exposure_base), 0)                      AS covered_value_base,
       coalesce(sum(CASE WHEN items.counts_as_valuables THEN items.exposure_base END), 0) AS valuables_value_base,
       cov.coverage_base * cov.valuables_limit_pct / 100.0        AS valuables_limit_base,
       coalesce(sum(CASE WHEN items.in_locker THEN items.exposure_base END), 0) AS locker_value_base,
       cov.locker_limit_base,
       CAST(julianday(cov.renewal_date) - julianday('now') AS INTEGER) AS days_to_renewal,
       CASE
         WHEN count(items.item_id) = 0 THEN 'no_items'
         WHEN coalesce(sum(items.exposure_base), 0) > cov.coverage_base THEN 'under_insured'
         WHEN cov.valuables_limit_pct IS NOT NULL AND
              coalesce(sum(CASE WHEN items.counts_as_valuables THEN items.exposure_base END), 0) > cov.coverage_base * cov.valuables_limit_pct / 100.0 THEN 'under_insured'
         WHEN cov.locker_limit_base IS NOT NULL AND
              coalesce(sum(CASE WHEN items.in_locker THEN items.exposure_base END), 0) > cov.locker_limit_base THEN 'under_insured'
         WHEN cov.policy_type <> 'household_contents' AND cov.coverage_base > 1.3 * coalesce(sum(items.exposure_base), 0) THEN 'potentially_over_insured'
         ELSE 'adequately_insured' END                            AS status
FROM cov LEFT JOIN items ON items.policy_id = cov.policy_id
GROUP BY cov.policy_id;

-- Bank-locker contents against the bank's own cover.
CREATE VIEW v_locker_contents AS
SELECT l.id AS location_id, l.name, b.bank_name, b.branch,
       '******' || coalesce(b.locker_number_last4, '') AS locker_number_masked,
       count(i.id) AS item_count,
       coalesce(sum(v.exposure_base), 0) AS contents_value_base,
       (b.bank_cover_minor / fx.scale) * fx.rate AS bank_cover_base,
       b.last_inspection_on, b.next_review_on
FROM storage_locations l
JOIN bank_lockers b ON b.location_id = l.id
LEFT JOIN v_fx_latest fx ON fx.currency_code = b.currency_code
LEFT JOIN inventory_items i ON i.location_id = l.id AND i.deleted_at IS NULL AND i.status = 'active'
LEFT JOIN v_item_values v ON v.item_id = i.id
WHERE l.deleted_at IS NULL
GROUP BY l.id;
