-- Sample vault — the same five items as the app's demo data.
-- Load after schema.sql and reference_data.sql. Sample ids are readable
-- UUID-shaped strings; real records use random UUIDs.
-- Confidential numbers: *_last4 only (the *_enc columns are filled by the app,
-- which holds the encryption key).

INSERT INTO fx_rates (currency_code, base_code, rate, as_of, source) VALUES
 ('NPR','EUR',0.0067,'2026-10-01','manual (sample)'),
 ('USD','EUR',0.86,'2026-10-01','manual (sample)');

-- people ----------------------------------------------------------------
INSERT INTO persons (id, full_name, relationship) VALUES
 ('00000000-0000-4000-8000-0000000000a1','Sachit Shrestha','self'),
 ('00000000-0000-4000-8000-0000000000a2','Family member (sample)','spouse'),
 ('00000000-0000-4000-8000-0000000000a3','Child (sample)','daughter'),
 ('00000000-0000-4000-8000-0000000000a4','Witness (sample)','friend');

INSERT INTO users (id, username, display_name, person_id, role, kdf_algorithm, kdf_params, wrapped_dek) VALUES
 ('00000000-0000-4000-8000-0000000000u1','sachit','Sachit Shrestha','00000000-0000-4000-8000-0000000000a1','administrator',
  'argon2id','{"m":65536,"t":3,"p":1,"salt":"c2FtcGxlLXNhbHQtMTIz"}', X'00');
INSERT INTO users (id, username, display_name, role, kdf_params, wrapped_dek, valid_until) VALUES
 ('00000000-0000-4000-8000-0000000000u2','valuer','Valuer (sample)','auditor','{"m":65536,"t":3,"p":1,"salt":"c2FtcGxl"}', X'00','2026-12-31T23:59:59Z');
INSERT INTO user_permissions (id, user_id, scope_type, scope_id, can_edit, expires_at) VALUES
 ('00000000-0000-4000-8000-0000000000q1','00000000-0000-4000-8000-0000000000u1','all',NULL,1,NULL),
 ('00000000-0000-4000-8000-0000000000q2','00000000-0000-4000-8000-0000000000u2','category','JWL',0,'2026-12-31T23:59:59Z');

-- locations ---------------------------------------------------------------
INSERT INTO storage_locations (id, name, location_type, address, country_code) VALUES
 ('00000000-0000-4000-8000-0000000000l1','Home – living room','home','Bergisch Gladbach','DE');
INSERT INTO storage_locations (id, name, location_type, parent_id, safe_certified, safe_standard, safe_grade, safe_weight_kg) VALUES
 ('00000000-0000-4000-8000-0000000000l2','Bedroom safe','home_safe','00000000-0000-4000-8000-0000000000l1',1,'EN 1143-1','Grade I',210);
INSERT INTO storage_locations (id, name, location_type, country_code) VALUES
 ('00000000-0000-4000-8000-0000000000l3','Bank locker – Sparkasse (sample)','bank_locker','DE'),
 ('00000000-0000-4000-8000-0000000000l4','Bank locker – Kathmandu (sample)','bank_locker','NP');
INSERT INTO bank_lockers (location_id, bank_name, branch, country_code, locker_number_last4, locker_type, agreement_ref_last4,
                          access_authority, bank_cover_minor, currency_code, liability_terms, last_inspection_on, next_review_on) VALUES
 ('00000000-0000-4000-8000-0000000000l3','Sample Sparkasse','Main branch','DE','4821','Size B','9134','Joint – either holder',
  1000000,'EUR','Bank group cover up to €10,000 per locker; top-up via partner insurer possible','2026-05-20','2027-05-20'),
 ('00000000-0000-4000-8000-0000000000l4','Sample Bank Nepal','New Road','NP','0917','Type B','0917','Holder + nominee',
  NULL,NULL,'Agreement excludes bank liability except for proven negligence','2025-02-10','2026-02-10');
INSERT INTO bank_locker_holders (location_id, person_id, holder_role) VALUES
 ('00000000-0000-4000-8000-0000000000l3','00000000-0000-4000-8000-0000000000a1','joint_holder'),
 ('00000000-0000-4000-8000-0000000000l3','00000000-0000-4000-8000-0000000000a2','joint_holder'),
 ('00000000-0000-4000-8000-0000000000l4','00000000-0000-4000-8000-0000000000a1','holder');

-- insurance ---------------------------------------------------------------
INSERT INTO insurance_policies (id, insurer, policy_number_last4, policyholder_person_id, policy_type, coverage_minor, currency_code,
       start_date, renewal_date, deductible_minor, valuables_limit_pct, outside_safe_limit_minor, locker_limit_minor,
       covers_theft, covers_fire, covers_water, covers_natural_hazards, covers_worldwide, covers_bank_locker, documentation_requirements) VALUES
 ('00000000-0000-4000-8000-0000000000p1','Sample Hausrat AG','9134','00000000-0000-4000-8000-0000000000a1','household_contents',
  9500000,'EUR','2026-01-01','2026-11-22',25000,20,2000000,2500000,1,1,1,0,0,1,
  'Invoices or appraisals for valuables over €3,000; photographs; list of bank-locker contents kept outside the locker.');

-- items -------------------------------------------------------------------
INSERT INTO inventory_items (id, inventory_code, category_code, subcategory, name, description, manufacturer, location_id) VALUES
 ('00000000-0000-4000-8000-0000000000i1','JWL-2026-00001','JWL','Necklace','Gold Necklace',
  '18K yellow gold curb-link necklace with pendant, 50 cm, box clasp','Sample Goldschmiede','00000000-0000-4000-8000-0000000000l3');
INSERT INTO inventory_items (id, inventory_code, category_code, name, description, location_id) VALUES
 ('00000000-0000-4000-8000-0000000000i2','DIA-2026-00001','DIA','Diamond solitaire ring','Platinum solitaire ring, round brilliant 1.02 ct','00000000-0000-4000-8000-0000000000l2'),
 ('00000000-0000-4000-8000-0000000000i3','COI-2026-00001','COI','Gold Asarphi coins (5 pcs)','Family gold coins, 10 g each','00000000-0000-4000-8000-0000000000l4'),
 ('00000000-0000-4000-8000-0000000000i4','ART-2026-00001','ART','Himalayan landscape, oil on canvas','Oil on canvas, 80 × 60 cm, signed lower right','00000000-0000-4000-8000-0000000000l1');
INSERT INTO inventory_items (id, inventory_code, category_code, name, description, brand, model, serial_number) VALUES
 ('00000000-0000-4000-8000-0000000000i5','WAT-2026-00001','WAT','Automatic wristwatch','Stainless steel, 40 mm','Sample Watch Co.','Explorer 40','SWC-88214');

INSERT INTO jewellery_details (item_id, jewellery_type, metal_type, metal_colour, purity_permille, gross_weight_g, net_metal_weight_g, hallmark, assay_certificate_no, metal_price_per_g_at_purchase_minor, metal_price_currency, length_mm) VALUES
 ('00000000-0000-4000-8000-0000000000i1','necklace','gold','yellow',750,52.4,51.8,'750, maker''s mark','ASY-2021-0815',4950,'EUR',500),
 ('00000000-0000-4000-8000-0000000000i3','coin','gold','fine',999,50,50,NULL,NULL,NULL,NULL,NULL),
 ('00000000-0000-4000-8000-0000000000i5','watch','steel',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO gemstone_details (id, item_id, gem_type, is_centre_stone, stone_count, carat_total, shape, cut_grade, colour_grade, clarity_grade, fluorescence, certification_authority, certificate_number, laser_inscription) VALUES
 ('00000000-0000-4000-8000-0000000000g1','00000000-0000-4000-8000-0000000000i2','diamond',1,1,1.02,'round','excellent','G','VS1','none','GIA','2195730461','GIA 2195730461');
INSERT INTO artwork_details (item_id, artist, title, creation_year, medium, width_cm, height_cm, signature) VALUES
 ('00000000-0000-4000-8000-0000000000i4','Sample Artist','Evening over Annapurna','2021','Oil on canvas',80,60,'front');
INSERT INTO item_attributes (item_id, attr_group, attr_key, attr_value) VALUES
 ('00000000-0000-4000-8000-0000000000i3','coin','issuing_country','Nepal'),
 ('00000000-0000-4000-8000-0000000000i3','coin','quantity','5'),
 ('00000000-0000-4000-8000-0000000000i5','watch','reference','214270'),
 ('00000000-0000-4000-8000-0000000000i5','watch','box_papers','Box and papers');

-- acquisition, ownership, beneficiaries -------------------------------------
INSERT INTO purchase_records (id, item_id, acquisition_method, acquired_on, purchase_date, seller, purchase_location, country_code, invoice_number, price_minor, currency_code) VALUES
 ('00000000-0000-4000-8000-0000000000r1','00000000-0000-4000-8000-0000000000i1','purchased','2021-06-15','2021-06-15','Sample Juwelier GmbH','Cologne','DE','INV-2021-12345',450000,'EUR'),
 ('00000000-0000-4000-8000-0000000000r2','00000000-0000-4000-8000-0000000000i2','purchased',NULL,'2019-03-08','Sample Diamonds Antwerp',NULL,'BE','SD-19-0442',820000,'EUR'),
 ('00000000-0000-4000-8000-0000000000r4','00000000-0000-4000-8000-0000000000i4','purchased',NULL,'2023-09-30','Sample Gallery Kathmandu',NULL,'NP',NULL,280000,'EUR'),
 ('00000000-0000-4000-8000-0000000000r5','00000000-0000-4000-8000-0000000000i5','purchased',NULL,'2022-12-20',NULL,NULL,NULL,NULL,690000,'EUR');
INSERT INTO purchase_records (id, item_id, acquisition_method, acquired_on, from_person_id, notes) VALUES
 ('00000000-0000-4000-8000-0000000000r3','00000000-0000-4000-8000-0000000000i3','inherited','2012-10-24',NULL,'Family coins');

INSERT INTO owners (id, item_id, person_id, ownership_type, share_pct, is_primary) VALUES
 ('00000000-0000-4000-8000-0000000000o1','00000000-0000-4000-8000-0000000000i1','00000000-0000-4000-8000-0000000000a1','sole',100,1),
 ('00000000-0000-4000-8000-0000000000o2','00000000-0000-4000-8000-0000000000i2','00000000-0000-4000-8000-0000000000a2','sole',100,1),
 ('00000000-0000-4000-8000-0000000000o3','00000000-0000-4000-8000-0000000000i3','00000000-0000-4000-8000-0000000000a1','family',50,1),
 ('00000000-0000-4000-8000-0000000000o4','00000000-0000-4000-8000-0000000000i3','00000000-0000-4000-8000-0000000000a2','family',50,0),
 ('00000000-0000-4000-8000-0000000000o5','00000000-0000-4000-8000-0000000000i4','00000000-0000-4000-8000-0000000000a1','sole',100,1),
 ('00000000-0000-4000-8000-0000000000o6','00000000-0000-4000-8000-0000000000i5','00000000-0000-4000-8000-0000000000a1','sole',100,1);
INSERT INTO beneficiaries (id, item_id, person_id, share_pct, designated_on) VALUES
 ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000i1','00000000-0000-4000-8000-0000000000a3',100,'2026-05-20'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000i2','00000000-0000-4000-8000-0000000000a3',100,'2025-11-02'),
 ('00000000-0000-4000-8000-0000000000b3','00000000-0000-4000-8000-0000000000i3','00000000-0000-4000-8000-0000000000a3',100,'2025-11-02');

-- insurance coverage ----------------------------------------------------------
INSERT INTO policy_items (policy_id, item_id) VALUES
 ('00000000-0000-4000-8000-0000000000p1','00000000-0000-4000-8000-0000000000i1'),
 ('00000000-0000-4000-8000-0000000000p1','00000000-0000-4000-8000-0000000000i2'),
 ('00000000-0000-4000-8000-0000000000p1','00000000-0000-4000-8000-0000000000i4');

-- evidence --------------------------------------------------------------------
INSERT INTO documents (id, item_id, document_type, title, reference_number, issued_on, file_name, mime_type, size_bytes, sha256, blob_ref) VALUES
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000i1','purchase_invoice','Invoice','INV-2021-12345','2021-06-15','INV-2021-12345.pdf','application/pdf',2338,printf('%064d',1),'blob/sample-d1'),
 ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000i1','certificate','Assay certificate','ASY-2021-0815','2021-06-15','gold-assay-certificate.pdf','application/pdf',2225,printf('%064d',2),'blob/sample-d2'),
 ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-0000000000i1','appraisal','Appraisal','GA-2026-118','2026-05-20','appraisal-2026-05-20.pdf','application/pdf',2314,printf('%064d',3),'blob/sample-d3'),
 ('00000000-0000-4000-8000-0000000000d4','00000000-0000-4000-8000-0000000000i2','purchase_invoice','Invoice','SD-19-0442','2019-03-08','SD-19-0442.pdf','application/pdf',2338,printf('%064d',4),'blob/sample-d4');
INSERT INTO photographs (id, item_id, view_type, caption, photographer, taken_at, taken_at_source, file_name, mime_type, size_bytes, sha256, blob_ref, sort_order) VALUES
 ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000i1','front','full necklace laid flat','Sachit Shrestha','2026-05-20T10:00:00Z','manual','necklace-front.jpg','image/jpeg',51200,printf('%064d',11),'blob/sample-f1',1),
 ('00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8000-0000000000i1','rear','reverse side','Sachit Shrestha','2026-05-20T10:01:00Z','manual','necklace-rear.jpg','image/jpeg',50100,printf('%064d',12),'blob/sample-f2',2),
 ('00000000-0000-4000-8000-0000000000f3','00000000-0000-4000-8000-0000000000i1','detail','pendant close-up','Sachit Shrestha','2026-05-20T10:02:00Z','manual','necklace-detail.jpg','image/jpeg',49800,printf('%064d',13),'blob/sample-f3',3),
 ('00000000-0000-4000-8000-0000000000f4','00000000-0000-4000-8000-0000000000i1','hallmark','750 hallmark on clasp','Sachit Shrestha','2026-05-20T10:03:00Z','manual','necklace-hallmark.jpg','image/jpeg',47300,printf('%064d',14),'blob/sample-f4',4),
 ('00000000-0000-4000-8000-0000000000f5','00000000-0000-4000-8000-0000000000i1','storage_location','in locker pouch','Sachit Shrestha','2026-05-20T10:04:00Z','manual','necklace-storage.jpg','image/jpeg',46100,printf('%064d',15),'blob/sample-f5',5),
 ('00000000-0000-4000-8000-0000000000f6','00000000-0000-4000-8000-0000000000i2','front',NULL,NULL,'2025-11-02T09:00:00Z','manual','ring-front.jpg','image/jpeg',40100,printf('%064d',16),'blob/sample-f6',1),
 ('00000000-0000-4000-8000-0000000000f7','00000000-0000-4000-8000-0000000000i2','certificate','GIA report',NULL,'2025-11-02T09:01:00Z','manual','ring-cert.jpg','image/jpeg',38900,printf('%064d',17),'blob/sample-f7',2),
 ('00000000-0000-4000-8000-0000000000f8','00000000-0000-4000-8000-0000000000i4','front',NULL,NULL,'2025-12-01T15:00:00Z','manual','painting-front.jpg','image/jpeg',61200,printf('%064d',18),'blob/sample-f8',1);

-- valuations ------------------------------------------------------------------
INSERT INTO valuation_records (id, item_id, valuation_type, value_minor, currency_code, valued_on, source, valuer_name, document_id) VALUES
 ('00000000-0000-4000-8000-0000000000v1','00000000-0000-4000-8000-0000000000i1','appraised',590000,'EUR','2026-05-20','professional_valuer','Sample Gutachter','00000000-0000-4000-8000-0000000000d3'),
 ('00000000-0000-4000-8000-0000000000v2','00000000-0000-4000-8000-0000000000i1','insurance',700000,'EUR','2026-05-20','insurance_appraisal','Sample Gutachter','00000000-0000-4000-8000-0000000000d3'),
 ('00000000-0000-4000-8000-0000000000v3','00000000-0000-4000-8000-0000000000i2','market',740000,'EUR','2025-11-02','dealer_quote',NULL,NULL),
 ('00000000-0000-4000-8000-0000000000v4','00000000-0000-4000-8000-0000000000i2','replacement',1150000,'EUR','2025-11-02','insurance_appraisal',NULL,NULL),
 ('00000000-0000-4000-8000-0000000000v5','00000000-0000-4000-8000-0000000000i3','estimated',60000000,'NPR','2022-01-15','owner_estimate',NULL,NULL),
 ('00000000-0000-4000-8000-0000000000v6','00000000-0000-4000-8000-0000000000i4','estimated',320000,'EUR','2025-12-01','owner_estimate',NULL,NULL);

-- witnesses and verification ----------------------------------------------------
INSERT INTO witnesses (id, person_id, full_name, relationship, is_independent) VALUES
 ('00000000-0000-4000-8000-0000000000w1','00000000-0000-4000-8000-0000000000a4','Witness (sample)','friend',1);
INSERT INTO verification_records (id, witness_id, verification_type, verified_on, place, location_id, comments) VALUES
 ('00000000-0000-4000-8000-0000000000x1','00000000-0000-4000-8000-0000000000w1','locker_inspection_witnessed','2026-05-20','Sample Sparkasse, main branch',
  '00000000-0000-4000-8000-0000000000l3','Necklace inspected, weighed (52.4 g) and photographed in the locker room.'),
 ('00000000-0000-4000-8000-0000000000x2','00000000-0000-4000-8000-0000000000w1','inventory_witnessed','2025-11-02','Home',NULL,NULL);
INSERT INTO verification_items (verification_id, item_id, present) VALUES
 ('00000000-0000-4000-8000-0000000000x1','00000000-0000-4000-8000-0000000000i1',1),
 ('00000000-0000-4000-8000-0000000000x2','00000000-0000-4000-8000-0000000000i2',1);

-- audit & backup ------------------------------------------------------------------
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value) VALUES
 ('00000000-0000-4000-8000-00000000log1','00000000-0000-4000-8000-0000000000u1','created','inventory_items','00000000-0000-4000-8000-0000000000i1','Gold Necklace (sample)'),
 ('00000000-0000-4000-8000-00000000log2','00000000-0000-4000-8000-0000000000u1','valuation_added','inventory_items','00000000-0000-4000-8000-0000000000i1','appraised 5900.00 EUR');
INSERT INTO backups (id, created_by, file_name, destination, size_bytes, sha256, item_count, file_count, schema_version, password_mode, verified, verified_at) VALUES
 ('00000000-0000-4000-8000-0000000000k1','00000000-0000-4000-8000-0000000000u1','valuables-backup-sample.vaultbak','External drive',359080,printf('%064d',99),5,12,1,'separate',1,'2026-10-08T12:21:24Z');
