"""Database schema tests: builds db/schema.sql + reference data + sample data in memory,
checks the computed views against the figures the app shows, and proves that every
integrity rule rejects bad data. Run: python3 tests/test_db.py"""
import pathlib, sqlite3, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / 'db'
I = lambda n: f'00000000-0000-4000-8000-0000000000{n}'   # sample id helper
failures = []


def connect():
    c = sqlite3.connect(':memory:')
    c.execute('PRAGMA foreign_keys = ON')
    for f in ['schema.sql', 'reference_data.sql', 'seed_sample.sql']:
        c.executescript((DB / f).read_text(encoding='utf-8'))
    return c


def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''))
    if not cond:
        failures.append(name)


def rejects(c, name, sql, params=()):
    try:
        c.execute('SAVEPOINT t'); c.execute(sql, params)
        check(name, False, 'statement was accepted')
    except sqlite3.DatabaseError as e:
        check(name, True)
    finally:
        c.execute('ROLLBACK TO t'); c.execute('RELEASE t')


c = connect()

# --- structure ----------------------------------------------------------------
tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = ['users', 'persons', 'owners', 'inventory_items', 'categories', 'jewellery_details', 'gemstone_details',
            'artwork_details', 'purchase_records', 'valuation_records', 'insurance_policies', 'storage_locations',
            'bank_lockers', 'documents', 'photographs', 'witnesses', 'verification_records', 'beneficiaries',
            'audit_logs', 'backups']
check('all required entities exist', all(t in tables for t in required), str([t for t in required if t not in tables]))
check('foreign keys consistent', c.execute('PRAGMA foreign_key_check').fetchall() == [])
check('integrity ok', c.execute('PRAGMA integrity_check').fetchone()[0] == 'ok')
check('schema version 1', c.execute('PRAGMA user_version').fetchone()[0] == 1)
strict = [t for t in required if 'STRICT' not in c.execute("SELECT sql FROM sqlite_master WHERE name=?", (t,)).fetchone()[0]]
check('core tables are STRICT', not strict, str(strict))

# --- computed values (must equal the app's dashboard for the sample vault) ------
p, cur, ins = c.execute('SELECT sum(purchase_base), sum(coalesce(current_base, purchase_base)), sum(insurance_base) FROM v_item_values').fetchone()
check('total purchase value 22,400 EUR', round(p, 2) == 22400, p)
check('total current value 27,420 EUR (NPR converted)', round(cur, 2) == 27420, cur)
check('total insurance value 18,500 EUR', round(ins, 2) == 18500, ins)
score = dict(c.execute('SELECT inventory_code, score FROM v_item_documentation').fetchall())
check('JWL-2026-00001 documentation 100 %', score['JWL-2026-00001'] == 100, score)
check('average documentation 66 %', round(sum(score.values()) / len(score)) == 66, score)
row = c.execute('SELECT status, valuables_value_base, valuables_limit_base FROM v_policy_coverage').fetchone()
check('policy under-insured via 20 % valuables sub-limit', row[0] == 'under_insured' and round(row[1]) == 21700 and round(row[2]) == 19000, row)
k, fine = c.execute(f"SELECT karat, fine_weight_g FROM jewellery_details WHERE item_id = '{I('i1')}'").fetchone()
check('750 purity = 18 K, 51.8 g -> 38.85 g fine gold', k == 18.0 and round(fine, 2) == 38.85, (k, fine))
lock = c.execute("SELECT locker_number_masked, contents_value_base, bank_cover_base FROM v_locker_contents WHERE name LIKE '%Sparkasse%'").fetchone()
check('locker view masks number and compares cover', lock == ('******4821', 7000.0, 10000.0), lock)

# --- integrity rules -------------------------------------------------------------
ins_item = "INSERT INTO inventory_items (id, inventory_code, category_code, name) VALUES (?,?,?,?)"
rejects(c, 'inventory code format enforced', ins_item, ('x1', 'JWL-26-1', 'JWL', 'x'))
rejects(c, 'inventory code prefix must match category', ins_item, ('x2', 'DIA-2026-00009', 'JWL', 'x'))
rejects(c, 'duplicate inventory code rejected', ins_item, ('x3', 'JWL-2026-00001', 'JWL', 'x'))
rejects(c, 'empty item name rejected', ins_item, ('x4', 'JWL-2026-00009', 'JWL', '  '))
rejects(c, 'unknown category rejected (FK)', ins_item, ('x5', 'ZZZ-2026-00001', 'ZZZ', 'x'))
rejects(c, 'duplicate serial number in category rejected',
        "INSERT INTO inventory_items (id, inventory_code, category_code, name, serial_number) VALUES ('x6','WAT-2026-00002','WAT','x','SWC-88214')")
rejects(c, 'ownership shares above 100 % rejected',
        f"INSERT INTO owners (id, item_id, person_id, share_pct) VALUES ('o9','{I('i3')}','{I('a3')}',10)")
rejects(c, 'second primary owner rejected',
        f"UPDATE owners SET is_primary = 1 WHERE id = '{I('o4')}'")
rejects(c, 'beneficiary shares above 100 % rejected',
        f"INSERT INTO beneficiaries (id, item_id, person_id, share_pct) VALUES ('b9','{I('i1')}','{I('a2')}',20)")
rejects(c, 'negative money rejected',
        f"INSERT INTO valuation_records (id, item_id, valuation_type, value_minor, currency_code, valued_on) VALUES ('v9','{I('i1')}','market',-1,'EUR','2026-01-01')")
rejects(c, 'impossible date rejected',
        f"INSERT INTO valuation_records (id, item_id, valuation_type, value_minor, currency_code, valued_on) VALUES ('v8','{I('i1')}','market',1,'EUR','2026-02-30')")
rejects(c, 'unknown valuation type rejected',
        f"INSERT INTO valuation_records (id, item_id, valuation_type, value_minor, currency_code, valued_on) VALUES ('v7','{I('i1')}','guess',1,'EUR','2026-01-01')")
rejects(c, 'unknown currency rejected',
        f"INSERT INTO valuation_records (id, item_id, valuation_type, value_minor, currency_code, valued_on) VALUES ('v6x','{I('i1')}','market',1,'XXX','2026-01-01')")
rejects(c, 'invalid diamond clarity rejected',
        f"INSERT INTO gemstone_details (id, item_id, gem_type, clarity_grade) VALUES ('g9','{I('i2')}','diamond','VVVS')")
rejects(c, 'net metal weight above gross weight rejected',
        f"UPDATE jewellery_details SET net_metal_weight_g = 60 WHERE item_id = '{I('i1')}'")
rejects(c, 'locker details on a non-locker location rejected',
        f"INSERT INTO bank_lockers (location_id, bank_name) VALUES ('{I('l1')}','Bank')")
rejects(c, 'certified flag only for safes',
        f"UPDATE storage_locations SET safe_certified = 1 WHERE id = '{I('l1')}'")
rejects(c, 'document must belong to exactly one record',
        f"INSERT INTO documents (id, item_id, policy_id, document_type, file_name, mime_type, size_bytes, sha256, blob_ref) VALUES ('d9','{I('i1')}','{I('p1')}','other','a.pdf','application/pdf',1,printf('%064d',9),'blob/x9')")
rejects(c, 'malformed SHA-256 rejected',
        f"INSERT INTO photographs (id, item_id, view_type, file_name, mime_type, size_bytes, sha256, blob_ref) VALUES ('f9','{I('i1')}','front','a.jpg','image/jpeg',1,'abc','blob/f9')")
rejects(c, 'auditor account must expire',
        "INSERT INTO users (id, username, display_name, role, kdf_params, wrapped_dek) VALUES ('u9','aud','A','auditor','{}',X'00')")
rejects(c, 'locker inspection needs a location',
        f"INSERT INTO verification_records (id, witness_id, verification_type, verified_on) VALUES ('x9','{I('w1')}','locker_inspection_witnessed','2026-01-01')")
rejects(c, 'audit log cannot be edited', "UPDATE audit_logs SET new_value = 'tampered'")
rejects(c, 'audit log cannot be deleted', 'DELETE FROM audit_logs')
rejects(c, 'active item cannot be purged', f"DELETE FROM inventory_items WHERE id = '{I('i5')}'")
rejects(c, 'verified backup needs a verification time',
        "INSERT INTO backups (id, file_name, size_bytes, sha256, item_count, file_count, schema_version, password_mode, verified) VALUES ('k9','b',1,printf('%064d',1),0,0,1,'vault',1)")
rejects(c, 'policy renewal before start rejected',
        "INSERT INTO insurance_policies (id, insurer, policy_type, coverage_minor, currency_code, start_date, renewal_date) VALUES ('p9','X','other',1,'EUR','2026-02-01','2026-01-01')")

# --- lifecycle: soft delete then purge cascades --------------------------------------
c.execute(f"UPDATE inventory_items SET status = 'deleted', deleted_at = '2026-10-08T12:00:00Z' WHERE id = '{I('i5')}'")
check('soft-deleted item leaves the totals', c.execute('SELECT count(*) FROM v_item_values').fetchone()[0] == 4)
c.execute(f"DELETE FROM inventory_items WHERE id = '{I('i5')}'")
left = c.execute(f"SELECT (SELECT count(*) FROM owners WHERE item_id='{I('i5')}') + (SELECT count(*) FROM purchase_records WHERE item_id='{I('i5')}') + (SELECT count(*) FROM item_attributes WHERE item_id='{I('i5')}')").fetchone()[0]
check('purge from recycle bin cascades to details', left == 0, left)
c.execute(f"UPDATE inventory_items SET updated_at = '2020-01-01T00:00:00.000Z' WHERE id = '{I('i1')}'")
c.execute(f"UPDATE inventory_items SET name = 'Gold Necklace (renamed)' WHERE id = '{I('i1')}'")
ts = c.execute(f"SELECT updated_at FROM inventory_items WHERE id='{I('i1')}'").fetchone()[0]
check('updated_at maintained by trigger', ts > '2026', ts)

print(f'\n{"FAILED: " + ", ".join(failures) if failures else "All database tests passed."}')
sys.exit(1 if failures else 0)
