-- Reporting queries used by the app (all verified by tests/test_db_queries.py against the sample vault).
-- Values are in the base currency (settings.base_currency).

-- Q1 Dashboard totals
SELECT count(*)                                         AS items,
       round(sum(purchase_base), 2)                     AS purchase_total,
       round(sum(coalesce(current_base, purchase_base)), 2) AS current_total,
       round(sum(insurance_base), 2)                    AS insurance_total
FROM v_item_values;

-- Q2 Current value by category
SELECT c.name AS category, count(*) AS items, round(sum(coalesce(v.current_base, v.purchase_base)), 2) AS current_value
FROM v_item_values v JOIN categories c ON c.code = v.category_code
GROUP BY c.code ORDER BY current_value DESC;

-- Q3 Bank-locker inventory (printable list for the next visit)
SELECT l.name AS locker, i.inventory_code, i.name, i.description,
       j.hallmark, j.gross_weight_g, g.certificate_number, round(v.exposure_base, 2) AS value
FROM inventory_items i
JOIN storage_locations l ON l.id = i.location_id AND l.location_type = 'bank_locker'
LEFT JOIN jewellery_details j ON j.item_id = i.id
LEFT JOIN gemstone_details g ON g.item_id = i.id AND g.is_centre_stone = 1
JOIN v_item_values v ON v.item_id = i.id
ORDER BY l.name, i.inventory_code;

-- Q4 Estate report: assets per beneficiary
SELECT p.full_name AS beneficiary, group_concat(i.inventory_code, ', ') AS assets,
       round(sum(coalesce(v.current_base, v.purchase_base) * coalesce(b.share_pct, 100) / 100), 2) AS value_share
FROM beneficiaries b
JOIN persons p ON p.id = b.person_id
JOIN inventory_items i ON i.id = b.item_id
JOIN v_item_values v ON v.item_id = i.id
WHERE b.revoked_on IS NULL
GROUP BY p.id ORDER BY value_share DESC;

-- Q5 Who owns what (current owners, with shares)
SELECT p.full_name AS owner, i.inventory_code, i.name, o.ownership_type, o.share_pct,
       round(coalesce(v.current_base, v.purchase_base) * o.share_pct / 100, 2) AS owned_value
FROM owners o JOIN persons p ON p.id = o.person_id
JOIN inventory_items i ON i.id = o.item_id JOIN v_item_values v ON v.item_id = i.id
WHERE o.ended_on IS NULL ORDER BY p.full_name, i.inventory_code;

-- Q6 Valuations that need renewing
SELECT d.inventory_code, d.name, v.current_valued_on, d.missing
FROM v_item_documentation d JOIN v_item_values v ON v.item_id = d.item_id
WHERE d.missing LIKE '%valuation%' ORDER BY v.current_valued_on;

-- Q7 Items not covered by any policy
SELECT v.inventory_code, v.name, round(v.exposure_base, 2) AS exposure
FROM v_item_values v
WHERE NOT EXISTS (SELECT 1 FROM v_item_policies p WHERE p.item_id = v.item_id)
ORDER BY exposure DESC;

-- Q8 Insurance renewals within the warning period
SELECT insurer, renewal_date, CAST(julianday(renewal_date) - julianday('now') AS INTEGER) AS days_left
FROM insurance_policies
WHERE status = 'active'
  AND julianday(renewal_date) - julianday('now') <= (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'renewal_warn_days');

-- Q9 Full valuation history of one item (chart data)
SELECT valued_on, valuation_type, value_minor, currency_code, source
FROM v_valuations_all WHERE item_id = :item_id ORDER BY valued_on;

-- Q10 Evidence package for a claim (photos + documents of one item)
SELECT 'photo' AS kind, view_type AS type, file_name, taken_at AS dated, sha256 FROM photographs WHERE item_id = :item_id AND deleted_at IS NULL
UNION ALL
SELECT 'document', document_type, file_name, issued_on, sha256 FROM documents WHERE item_id = :item_id AND deleted_at IS NULL
ORDER BY kind, dated;
