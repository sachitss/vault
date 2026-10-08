"""Migrate a Valuables Vault backup (.vaultbak, app 0.9) into the relational schema (db/schema.sql).

  python3 tools/vaultbak_to_sqlite.py BACKUP.vaultbak            # check only: load into memory, validate, report
  python3 tools/vaultbak_to_sqlite.py BACKUP.vaultbak --out v.db # also write a SQLite file

The password is asked interactively (or VV_BACKUP_PASSWORD for automated tests).

SECURITY: --out writes an UNENCRYPTED SQLite file with your inventory (confidential
numbers are reduced to their last 4 digits, photos/documents are referenced, not copied).
Use it on an encrypted disk and delete it afterwards. The native app performs the same
migration into its SQLCipher-encrypted database.
"""
import argparse, base64, getpass, hashlib, json, os, pathlib, sqlite3, sys, uuid

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = pathlib.Path(__file__).resolve().parents[1]

LOC_TYPES = {'Home': 'home', 'Home safe': 'home_safe', 'Office safe': 'office_safe', 'Bank locker': 'bank_locker',
             'Family member': 'family_member', 'Other secure location': 'other_secure'}
POLICY_TYPES = {'Household contents (Hausrat)': 'household_contents', 'Valuables / all-risk (Valoren)': 'valuables_all_risk',
                'Bank locker contents': 'bank_locker', 'Art / collection': 'art_collection'}
OWN_TYPES = {'Sole': 'sole', 'Joint': 'joint', 'Family': 'family', 'Trust / estate': 'trust', 'Other': 'other'}
ACQ = {'Purchased': 'purchased', 'Inherited': 'inherited', 'Gift': 'gift', 'Family property': 'family_property', 'Other': 'other'}
VAL_SOURCES = {'Professional valuer': 'professional_valuer', 'Insurance appraisal': 'insurance_appraisal', 'Dealer quote': 'dealer_quote',
               'Metal spot price': 'metal_spot_price', 'Auction result': 'auction_result', 'Owner estimate': 'owner_estimate', 'Other': 'other'}
DOC_TYPES = {'Purchase invoice': 'purchase_invoice', 'Receipt': 'receipt', 'Bank statement': 'bank_statement', 'Certificate': 'certificate',
             'Appraisal': 'appraisal', 'Insurance document': 'insurance_document', 'Warranty': 'warranty',
             'Ownership document': 'ownership_document', 'Authenticity certificate': 'authenticity_certificate',
             'Import/export documentation': 'import_export', 'Restoration documentation': 'restoration', 'Other evidence': 'other'}
VER_TYPES = {'Inventory witnessed': 'inventory_witnessed', 'Ownership verified': 'ownership_verified', 'Photograph verified': 'photograph_verified',
             'Valuation verified': 'valuation_verified', 'Locker inspection witnessed': 'locker_inspection_witnessed'}
AUDIT = {'Created': 'created', 'Edited': 'edited', 'Deleted (soft)': 'deleted', 'Restored': 'restored', 'Deleted permanently': 'purged',
         'Valuation added': 'valuation_added', 'Valuation removed': 'valuation_removed', 'Owner changed': 'owner_changed',
         'Location changed': 'location_changed', 'Insurance policy changed': 'policy_changed', 'Document added': 'document_added',
         'Photograph added': 'photo_added', 'File removed': 'document_removed', 'Verification recorded': 'verification_recorded',
         'Confidential value revealed': 'confidential_revealed', 'Export performed': 'export', 'Report created': 'report',
         'Backup performed': 'backup', 'Backup restored': 'restore', 'Import performed': 'import', 'Unlocked': 'login',
         'Password changed': 'password_changed', 'Settings changed': 'settings_changed', 'Vault created': 'created',
         'Sample data loaded': 'import', 'Sample data removed': 'deleted', 'Decrypted file downloaded': 'export'}
CLARITY = {'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'}
SIGNATURE = {'Signed front': 'front', 'Signed back': 'back', 'Signed front and back': 'front_and_back', 'Monogram': 'monogram', 'Unsigned': 'unsigned'}
ATTR_GROUPS = {'watch': ['reference', 'caseNumber', 'boxPapers', 'lastService'],
               'coin': ['issuingCountry', 'year', 'denomination', 'quantity', 'mintMark', 'grade', 'gradingService'],
               'antique': ['period', 'origin', 'maker', 'condition', 'provenance', 'restoration'],
               'electronics': ['imei', 'warrantyUntil'], 'document': ['docType', 'issuer', 'issueDate', 'docNumber', 'expiry'],
               'dimensions': ['material', 'length', 'width', 'height', 'weight']}
CONFIDENTIAL_ATTRS = {'imei', 'docNumber'}


def decrypt_backup(path: pathlib.Path, password: str) -> dict:
    o = json.loads(path.read_text(encoding='utf-8'))
    if o.get('format') != 'valuables-vault-backup':
        sys.exit('Not a Valuables Vault backup file.')
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=base64.b64decode(o['salt']), iterations=o['iter'])
    key = kdf.derive(password.encode('utf-8'))
    try:
        plain = AESGCM(key).decrypt(base64.b64decode(o['iv']), base64.b64decode(o['ct']), None)
    except Exception:
        sys.exit('Wrong password or damaged backup.')
    return json.loads(plain)


class Migrator:
    def __init__(self, db: dict):
        self.d = db; self.warn = []; self.ids = {}
        self.c = sqlite3.connect(':memory:'); self.c.execute('PRAGMA foreign_keys = ON')
        for f in ['schema.sql', 'reference_data.sql']:
            self.c.executescript((ROOT / 'db' / f).read_text(encoding='utf-8'))
        self.scale = dict(self.c.execute('SELECT code, scale FROM currencies'))

    # helpers ---------------------------------------------------------------
    def nid(self, old):  # stable new UUID per old id
        if old not in self.ids:
            self.ids[old] = str(uuid.uuid4())
        return self.ids[old]

    def ensure_currency(self, code):
        code = (code or self.d['settings'].get('baseCurrency') or 'EUR').upper()
        if code not in self.scale:
            self.c.execute('INSERT INTO currencies (code, name, minor_unit) VALUES (?,?,2)', (code, code)); self.scale[code] = 100.0
        return code

    def minor(self, v, cur):
        if v in (None, ''):
            return None
        return int(round(float(v) * self.scale[self.ensure_currency(cur)]))

    @staticmethod
    def last4(v):
        return str(v)[-4:] if v else None

    def ins(self, table, row: dict):
        row = {k: v for k, v in row.items() if v is not None and v != ''}
        cols = ', '.join(row); qs = ', '.join('?' * len(row))
        self.c.execute(f'INSERT INTO {table} ({cols}) VALUES ({qs})', list(row.values()))

    # migration ---------------------------------------------------------------
    def run(self):
        d, st = self.d, self.d['settings']
        base = self.ensure_currency(st.get('baseCurrency'))
        self.c.execute("UPDATE settings SET value = ? WHERE key = 'base_currency'", (base,))
        for k, sk in [('valuationMaxAgeMonths', 'valuation_max_age_months'), ('metalMaxAgeMonths', 'metal_max_age_months'),
                      ('renewalWarnDays', 'renewal_warn_days'), ('backupReminderDays', 'backup_reminder_days'), ('autoLockMin', 'auto_lock_minutes')]:
            if st.get(k) is not None:
                self.c.execute('UPDATE settings SET value = ? WHERE key = ?', (str(st[k]), sk))
        as_of = st.get('fxDate') or d.get('updated', '')[:10] or '2026-01-01'
        for cur, rate in (st.get('fx') or {}).items():
            if cur != base and rate:
                self.ensure_currency(cur)
                self.ins('fx_rates', {'currency_code': cur, 'base_code': base, 'rate': float(rate), 'as_of': as_of, 'source': 'app 0.9 settings'})

        admin = str(uuid.uuid4())
        self.ins('users', {'id': admin, 'username': 'owner', 'display_name': st.get('userName') or 'Vault owner', 'role': 'administrator',
                           'kdf_algorithm': 'pbkdf2-sha256', 'kdf_params': json.dumps({'note': 'set on first unlock in the native app'}),
                           'wrapped_dek': b'\x00'})
        self.ins('user_permissions', {'id': str(uuid.uuid4()), 'user_id': admin, 'scope_type': 'all', 'can_edit': 1, 'can_reveal_confidential': 1})

        for p in d['people']:
            self.ins('persons', {'id': self.nid(p['id']), 'full_name': p['name'], 'relationship': p.get('relationship'),
                                 'email': p.get('contact') if '@' in (p.get('contact') or '') else None,
                                 'phone': None if '@' in (p.get('contact') or '') else p.get('contact'), 'notes': p.get('notes')})

        for l in d['locations']:
            t = LOC_TYPES.get(l.get('type'), 'other_secure'); sf = l.get('safe') or {}
            self.ins('storage_locations', {'id': self.nid(l['id']), 'name': l['name'], 'location_type': t, 'address': l.get('address'),
                                           'safe_certified': 1 if (sf.get('certified') and t in ('home_safe', 'office_safe')) else 0,
                                           'safe_grade': sf.get('grade'), 'notes': l.get('notes')})
            if t == 'bank_locker':
                L = l.get('locker') or {}
                cover = L.get('bankInsured')
                cur = self.ensure_currency(L.get('bankInsuredCurrency')) if cover not in (None, '') else None
                self.ins('bank_lockers', {'location_id': self.nid(l['id']), 'bank_name': L.get('bank') or l['name'], 'branch': L.get('branch'),
                                          'locker_number_last4': self.last4(L.get('number')), 'locker_type': L.get('lockerType'),
                                          'agreement_ref_last4': self.last4(L.get('agreementRef')), 'access_authority': L.get('access'),
                                          'bank_cover_minor': self.minor(cover, cur) if cur else None, 'currency_code': cur,
                                          'liability_terms': L.get('insuranceNotes'), 'last_inspection_on': L.get('lastInspection') or None,
                                          'next_review_on': L.get('nextReview') or None})
                for hid in L.get('holderIds') or []:
                    if hid in self.ids:
                        self.ins('bank_locker_holders', {'location_id': self.nid(l['id']), 'person_id': self.ids[hid], 'holder_role': 'holder'})
                if L.get('number'):
                    self.warn.append(f"{l['name']}: locker number kept as last 4 digits only (full number is encrypted by the native app)")

        for p in d['policies']:
            cur = self.ensure_currency(p.get('currency')); m = lambda k: self.minor(p.get(k), cur)
            locker_cov = 1 if p.get('lockerCoverage') else 0
            locker_lim = m('lockerLimit') if locker_cov else None
            if p.get('lockerLimit') and not locker_cov:
                self.warn.append(f"{p['insurer']}: locker limit ignored because the policy is not marked as covering lockers")
            self.ins('insurance_policies', {
                'id': self.nid(p['id']), 'insurer': p['insurer'], 'policy_number_last4': self.last4(p.get('number')),
                'policyholder_person_id': self.ids.get(p.get('holderId')), 'policy_type': POLICY_TYPES.get(p.get('type'), 'other'),
                'coverage_minor': m('coverage') or 0, 'currency_code': cur, 'start_date': p.get('start') or None, 'renewal_date': p.get('renewal') or None,
                'deductible_minor': m('deductible'), 'valuables_limit_pct': float(p['valuablesPct']) if p.get('valuablesPct') not in (None, '') else None,
                'outside_safe_limit_minor': m('outsideSafeLimit'), 'jewellery_limit_minor': m('jewelleryLimit'), 'gold_limit_minor': m('goldLimit'),
                'art_limit_minor': m('artLimit'), 'per_item_limit_minor': m('itemLimit'), 'locker_limit_minor': locker_lim,
                'covers_theft': 1 if p.get('theft') else 0, 'covers_fire': 1 if p.get('fire') else 0, 'covers_water': 1 if p.get('water') else 0,
                'covers_natural_hazards': 1 if p.get('natural') else 0, 'covers_worldwide': 1 if p.get('worldwide') else 0,
                'covers_bank_locker': locker_cov, 'documentation_requirements': p.get('docRequirements')})
            if p.get('locationId') in self.ids:
                self.ins('policy_locations', {'policy_id': self.nid(p['id']), 'location_id': self.ids[p['locationId']]})

        files_by_id = {f['id']: f for f in d['files']}
        for it in d['items']:
            self.item(it)
        for f in d['files']:
            if f['itemId'] not in self.ids:
                continue
            common = {'file_name': f['name'], 'mime_type': f.get('mime') or 'application/octet-stream', 'size_bytes': max(1, f.get('size') or 1),
                      'sha256': f['sha256'], 'blob_ref': f"vaultbak:{f['id']}", 'uploaded_at': f.get('uploadTs')}
            if f['kind'] == 'photo':
                ex = f.get('exif') or {}
                self.ins('photographs', {'id': self.nid(f['id']), 'item_id': self.ids[f['itemId']],
                                         'view_type': (f.get('view') or 'other').lower().replace(' ', '_'), 'caption': f.get('caption'),
                                         'photographer': f.get('photographer'), 'taken_at': f.get('photoDate'),
                                         'taken_at_source': {'EXIF': 'exif', 'file date': 'file'}.get(f.get('photoDateSource'), 'manual'),
                                         'camera': ex.get('camera'), 'exif_json': json.dumps(ex) if ex else None, **common})
            else:
                self.ins('documents', {'id': self.nid(f['id']), 'item_id': self.ids[f['itemId']], 'document_type': DOC_TYPES.get(f.get('docType'), 'other'),
                                       'reference_number': f.get('ref'), 'issued_on': f.get('docDate') or None, **common})

        for v in d['valuations']:
            if v['itemId'] not in self.ids:
                continue
            cur = self.ensure_currency(v.get('currency')); src = VAL_SOURCES.get(v.get('source'))
            self.ins('valuation_records', {'id': self.nid(v['id']), 'item_id': self.ids[v['itemId']], 'valuation_type': v['type'].lower(),
                                           'value_minor': self.minor(v['value'], cur), 'currency_code': cur, 'valued_on': v['date'],
                                           'source': src or ('import' if 'import' in (v.get('source') or '').lower() else 'other'),
                                           'valuer_name': v.get('valuer'), 'document_id': self.ids.get(v.get('docId')) if v.get('docId') in files_by_id else None,
                                           'notes': '; '.join(x for x in [v.get('notes'), None if src else v.get('source')] if x)})

        witnesses = {}
        for v in d['verifications']:
            key = (v['witness'].strip().lower(), (v.get('relationship') or '').lower())
            if key not in witnesses:
                witnesses[key] = str(uuid.uuid4())
                pid = next((p['id'] for p in d['people'] if p['name'].strip().lower() == key[0]), None)
                self.ins('witnesses', {'id': witnesses[key], 'person_id': self.ids.get(pid), 'full_name': v['witness'],
                                       'relationship': v.get('relationship'), 'id_reference_last4': self.last4(v.get('idRef'))})
            vt = VER_TYPES.get(v['type'], 'inventory_witnessed')
            loc = self.ids.get(v.get('locationId'))
            if vt == 'locker_inspection_witnessed' and not loc:
                vt = 'inventory_witnessed'; self.warn.append(f"verification {v['date']}: locker inspection without location recorded as inventory witnessed")
            self.ins('verification_records', {'id': self.nid(v['id']), 'witness_id': witnesses[key], 'verification_type': vt, 'verified_on': v['date'],
                                              'place': v.get('place'), 'location_id': loc, 'comments': v.get('comments'),
                                              'signed_on_paper': 0, 'recorded_at': v.get('recorded')})
            if v.get('signature'):
                self.warn.append(f"verification {v['date']} ({v['witness']}): on-screen signature not migrated by this tool (the native app stores it encrypted)")
            for iid in v.get('itemIds') or []:
                if iid in self.ids:
                    self.ins('verification_items', {'verification_id': self.nid(v['id']), 'item_id': self.ids[iid]})

        prev = None
        for a in d['audit']:
            action = AUDIT.get(a['action'], 'edited')
            row = {'id': self.nid(a['id']), 'occurred_at': a['ts'], 'user_id': admin, 'action': action, 'entity_type': a.get('entity') or 'vault',
                   'entity_id': a.get('ref') or None, 'field': a.get('field') or (None if a['action'] in AUDIT else a['action']),
                   'old_value': a.get('prev') or None, 'new_value': a.get('next') or None}
            h = hashlib.sha256(((prev or '') + json.dumps(row, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()
            self.ins('audit_logs', {**row, 'prev_hash': prev, 'hash': h}); prev = h

        for b in d['backups']:
            self.ins('backups', {'id': str(uuid.uuid4()), 'created_at': b['ts'], 'created_by': admin, 'file_name': b['file'], 'size_bytes': b['size'],
                                 'sha256': b['sha256'], 'item_count': b['items'], 'file_count': b['files'], 'schema_version': 0,
                                 'password_mode': 'separate' if b.get('pwmode') == 'own' else 'vault', 'verified': 1 if b.get('verified') else 0,
                                 'verified_at': b['ts'] if b.get('verified') else None, 'notes': 'from app 0.9'})
        for r in d['imports']:
            self.ins('import_runs', {'id': str(uuid.uuid4()), 'started_at': r['ts'], 'user_id': admin, 'file_name': r['file'], 'row_count': r.get('rows', 0),
                                     'created_count': r.get('created', 0), 'updated_count': r.get('updated', 0), 'skipped_count': r.get('skipped', 0),
                                     'error_count': r.get('errors', 0)})
        self.c.commit()
        return self

    def item(self, it):
        new = self.nid(it['id']); d = it.get('details') or {}
        deleted = bool(it.get('deleted'))
        self.ins('inventory_items', {'id': new, 'inventory_code': it['id'], 'category_code': it['cat'], 'subcategory': it.get('subcat'),
                                     'name': it['name'], 'description': it.get('description'), 'brand': it.get('brand'),
                                     'manufacturer': it.get('manufacturer'), 'model': it.get('model'), 'serial_number': it.get('serial'),
                                     'identification_number': it.get('idNumber'), 'location_id': self.ids.get(it.get('locationId')),
                                     'notes': it.get('notes'), 'status': 'deleted' if deleted else 'active',
                                     'deleted_at': it.get('deletedAt') or ('1970-01-01T00:00:00Z' if deleted else None),
                                     'created_at': it.get('created'), 'updated_at': it.get('updated')})
        # category details
        if any(k in d for k in ('metalType', 'purity', 'grossWeight', 'netMetalWeight', 'hallmark')):
            gw, nw = d.get('grossWeight'), d.get('netMetalWeight')
            if gw and nw and float(nw) > float(gw):
                self.warn.append(f"{it['id']}: net metal weight above gross weight — gross weight dropped"); gw = None
            self.ins('jewellery_details', {'item_id': new, 'jewellery_type': (it.get('subcat') or '').lower() or None,
                                           'metal_type': (d.get('metalType') or '').lower() or None,
                                           'metal_colour': {'Yellow': 'yellow', 'White': 'white', 'Rose': 'rose', 'Two-tone': 'two_tone', 'Fine (bullion)': 'fine'}.get(d.get('goldColour')),
                                           'purity_permille': int(round(float(d['purity']))) if d.get('purity') not in (None, '') and 0 < float(d['purity']) <= 1000 else None,
                                           'gross_weight_g': float(gw) if gw else None, 'net_metal_weight_g': float(nw) if nw else None,
                                           'hallmark': d.get('hallmark'), 'assay_certificate_no': d.get('assayCert'),
                                           'metal_price_per_g_at_purchase_minor': self.minor(d.get('metalPricePurchase'), it.get('currency')),
                                           'metal_price_currency': self.ensure_currency(it.get('currency')) if d.get('metalPricePurchase') else None,
                                           'length_mm': float(d['length']) if d.get('length') and it['cat'] in ('JWL', 'GLD') else None})
        if d.get('gemType') or d.get('carat'):
            cl = (d.get('clarity') or '').upper()
            self.ins('gemstone_details', {'id': str(uuid.uuid4()), 'item_id': new, 'gem_type': (d.get('gemType') or 'unknown').lower(), 'is_centre_stone': 1,
                                          'stone_count': int(d.get('gemCount') or 1), 'carat_total': float(d['carat']) if d.get('carat') else None,
                                          'shape': (d.get('shape') or '').lower() or None,
                                          'cut_grade': (d.get('cut') or '').lower().replace(' ', '_') or None, 'colour_grade': d.get('colour'),
                                          'clarity_grade': cl if cl in CLARITY else None,
                                          'fluorescence': (d.get('fluorescence') or '').lower().replace(' ', '_') or None,
                                          'certification_authority': d.get('certAuthority'), 'certificate_number': d.get('certNumber') if it['cat'] in ('DIA', 'JWL') else None,
                                          'laser_inscription': d.get('laserInscription')})
        if it['cat'] == 'ART':
            self.ins('artwork_details', {'item_id': new, 'artist': d.get('artist'), 'title': d.get('title'), 'creation_year': d.get('creationYear'),
                                         'medium': d.get('medium'),
                                         'width_cm': float(d.get('width') or d.get('length')) / 10 if (d.get('width') or d.get('length')) else None,
                                         'height_cm': float(d['height']) / 10 if d.get('height') else None,
                                         'signature': SIGNATURE.get(d.get('signature')), 'edition_number': None,
                                         'provenance': d.get('provenance'), 'previous_owners': d.get('previousOwner'), 'gallery_dealer': d.get('gallery'),
                                         'authenticity_certificate_no': d.get('certNumber'), 'restoration_history': d.get('restoration')})
        for group, keys in ATTR_GROUPS.items():
            if group == 'dimensions' and it['cat'] in ('ART', 'JWL', 'GLD'):
                continue
            for k in keys:
                if d.get(k) not in (None, ''):
                    self.ins('item_attributes', {'item_id': new, 'attr_group': group, 'attr_key': k, 'attr_value': str(d[k]),
                                                 'is_confidential': 1 if k in CONFIDENTIAL_ATTRS else 0})
        if it['cat'] in ('WAT', 'COI') and d.get('certNumber'):
            self.ins('item_attributes', {'item_id': new, 'attr_group': 'watch' if it['cat'] == 'WAT' else 'coin', 'attr_key': 'certNumber', 'attr_value': d['certNumber']})
        # acquisition
        acq = ACQ.get(it.get('acquisition') or 'Purchased', 'other')
        price = it.get('purchasePrice'); has_price = price not in (None, '')
        if acq != 'purchased' or has_price or it.get('purchaseDate') or it.get('invoiceNo'):
            cur = self.ensure_currency(it.get('currency')) if has_price else None
            self.ins('purchase_records', {'id': str(uuid.uuid4()), 'item_id': new, 'acquisition_method': acq, 'acquired_on': it.get('acquiredDate') or None,
                                          'purchase_date': it.get('purchaseDate') or None, 'seller': it.get('seller'), 'purchase_location': it.get('purchaseLocation'),
                                          'invoice_number': it.get('invoiceNo'), 'price_minor': self.minor(price, cur) if has_price else None, 'currency_code': cur})
        # ownership
        co = [p for p in (it.get('coOwnerIds') or []) if p in self.ids and p != it.get('ownerId')]
        if it.get('ownerId') in self.ids:
            pct = float(it['ownershipPct']) if it.get('ownershipPct') not in (None, '') else 100.0
            co_share = None
            if co and pct >= 100:
                pct = co_share = 100.0 / (len(co) + 1)
                self.warn.append(f"{it['id']}: owner held 100 % but co-owners exist — shares split equally ({pct:.1f} % each)")
            elif co:
                co_share = (100.0 - pct) / len(co)
            otype = OWN_TYPES.get(it.get('ownershipType'), 'sole')
            self.ins('owners', {'id': str(uuid.uuid4()), 'item_id': new, 'person_id': self.ids[it['ownerId']], 'ownership_type': otype,
                                'share_pct': pct, 'is_primary': 1})
            for p in co:
                self.ins('owners', {'id': str(uuid.uuid4()), 'item_id': new, 'person_id': self.ids[p],
                                    'ownership_type': otype if otype != 'sole' else 'joint', 'share_pct': co_share, 'is_primary': 0})
        for b in it.get('beneficiaryIds') or []:
            if b in self.ids:
                self.ins('beneficiaries', {'id': str(uuid.uuid4()), 'item_id': new, 'person_id': self.ids[b]})
        if it.get('policyId') in self.ids:
            self.ins('policy_items', {'policy_id': self.ids[it['policyId']], 'item_id': new})

    def report(self):
        c = self.c
        counts = {t: c.execute(f'SELECT count(*) FROM {t}').fetchone()[0] for t in
                  ['persons', 'storage_locations', 'bank_lockers', 'insurance_policies', 'inventory_items', 'jewellery_details', 'gemstone_details',
                   'artwork_details', 'item_attributes', 'purchase_records', 'owners', 'beneficiaries', 'valuation_records', 'documents', 'photographs',
                   'witnesses', 'verification_records', 'audit_logs', 'backups']}
        fk = c.execute('PRAGMA foreign_key_check').fetchall()
        ok = c.execute('PRAGMA integrity_check').fetchone()[0]
        totals = c.execute('SELECT round(sum(purchase_base),2), round(sum(coalesce(current_base, purchase_base)),2), round(sum(insurance_base),2) FROM v_item_values').fetchone()
        return counts, fk, ok, totals


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('backup', type=pathlib.Path)
    ap.add_argument('--out', type=pathlib.Path, help='write an (unencrypted) SQLite file')
    a = ap.parse_args()
    pw = os.environ.get('VV_BACKUP_PASSWORD') or getpass.getpass('Backup password: ')
    m = Migrator(decrypt_backup(a.backup, pw)['db']).run()
    counts, fk, ok, totals = m.report()
    print('Migrated rows:'); [print(f'  {k:22} {v}') for k, v in counts.items()]
    print(f'Integrity: {ok}; foreign-key problems: {len(fk)}')
    print(f'Totals (base currency): purchase {totals[0]}, current {totals[1]}, insurance {totals[2]}')
    if m.warn:
        print('Notes:'); [print('  - ' + w) for w in m.warn]
    if a.out:
        if a.out.exists():
            sys.exit(f'{a.out} exists — refusing to overwrite.')
        dst = sqlite3.connect(a.out); m.c.backup(dst); dst.close()
        print(f'Written {a.out} (UNENCRYPTED — keep it on an encrypted disk and delete it after use).')
    sys.exit(0 if ok == 'ok' and not fk else 1)


if __name__ == '__main__':
    main()
