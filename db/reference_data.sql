-- Reference data loaded into every new vault database (after schema.sql).
INSERT INTO currencies (code, name, minor_unit) VALUES
 ('EUR','Euro',2), ('USD','US dollar',2), ('GBP','Pound sterling',2), ('CHF','Swiss franc',2),
 ('NPR','Nepalese rupee',2), ('INR','Indian rupee',2), ('AED','UAE dirham',2), ('JPY','Japanese yen',0),
 ('AUD','Australian dollar',2), ('CAD','Canadian dollar',2), ('CNY','Chinese yuan',2), ('SGD','Singapore dollar',2),
 ('HKD','Hong Kong dollar',2), ('SEK','Swedish krona',2), ('NOK','Norwegian krone',2), ('DKK','Danish krone',2),
 ('PLN','Polish złoty',2), ('CZK','Czech koruna',2);

-- detail_kind decides which detail table the app shows; cert_expected drives the completeness score;
-- counts_as_valuables marks what German household policies treat as "Wertsachen".
INSERT INTO categories (code, name, detail_kind, cert_expected, counts_as_valuables, sort_order) VALUES
 ('JWL','Jewellery','jewellery',1,1,10),
 ('GLD','Gold & Precious Metals','jewellery',1,1,20),
 ('DIA','Diamonds & Gemstones','gemstone',1,1,30),
 ('WAT','Watches','attributes',1,1,40),
 ('COI','Coins & Medals','attributes',1,1,50),
 ('ART','Artwork & Paintings','artwork',1,1,60),
 ('ANT','Antiques & Collectibles','attributes',0,1,70),
 ('ELE','Electronics','attributes',0,0,80),
 ('DOC','Documents & Certificates','attributes',0,0,90),
 ('OTH','Other Valuables','attributes',0,0,100);

INSERT INTO settings (key, value) VALUES
 ('base_currency','EUR'),
 ('valuation_max_age_months','36'),
 ('metal_max_age_months','12'),
 ('renewal_warn_days','60'),
 ('appraisal_threshold_minor','500000'),
 ('backup_reminder_days','30'),
 ('auto_lock_minutes','5');
