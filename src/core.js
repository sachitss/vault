'use strict';
/* =====================================================================
   Valuables Vault — core: crypto, storage, data model, computations
   All inventory data is encrypted with AES-256-GCM before it touches disk.
   ===================================================================== */
const SCHEMA = window.__SCHEMA;
const APP_VERSION = '0.9.0-prototype';
const PBKDF2_ITER = 600000;
const enc = new TextEncoder(), dec = new TextDecoder();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- base64 ---------- */
function b64(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
  return btoa(s);
}
function unb64(str) { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function sha256hex(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); }

/* ---------- crypto ---------- */
async function deriveKEK(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function aesEnc(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv, ct: new Uint8Array(ct) };
}
async function aesDec(key, iv, ct) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)); }
async function importDEK(raw) { return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }

/* ---------- IndexedDB ---------- */
let _idb = null;
function idb() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const r = indexedDB.open('valuables-vault', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('blobs'); };
    r.onsuccess = () => { _idb = r.result; res(_idb); };
    r.onerror = () => rej(r.error);
  });
}
async function idbOp(store, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, mode); const st = tx.objectStore(store); let out;
    const req = fn(st); if (req) req.onsuccess = () => { out = req.result; };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
}
const kvGet = k => idbOp('kv', 'readonly', s => s.get(k));
const kvPut = (k, v) => idbOp('kv', 'readwrite', s => s.put(v, k));
const blobKeys = () => idbOp('blobs', 'readonly', s => s.getAllKeys());

/* ---------- vault session ---------- */
let KEY = null;      // data-encryption key (non-extractable CryptoKey) — only in memory while unlocked
let S = null;        // decrypted database — only in memory while unlocked
let META = null;     // unencrypted header: salt, iterations, wrapped DEK, failed-login counter

async function vaultExists() { META = await kvGet('meta'); return !!META; }

async function createVault(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const kek = await deriveKEK(password, salt, PBKDF2_ITER);
  const w = await aesEnc(kek, raw);
  META = { v: 1, salt: b64(salt), iter: PBKDF2_ITER, wIv: b64(w.iv), wrapped: b64(w.ct), created: nowISO(), failed: 0, lockUntil: 0 };
  await kvPut('meta', META);
  KEY = await importDEK(raw); raw.fill(0);
  S = emptyDB();
  audit('Vault created', 'vault', '', '', '');
  await saveNow();
}

async function unwrapWith(password) {
  const kek = await deriveKEK(password, unb64(META.salt), META.iter);
  return aesDec(kek, unb64(META.wIv), unb64(META.wrapped)); // throws on wrong password
}

async function unlockVault(password) {
  META = await kvGet('meta');
  const wait = (META.lockUntil || 0) - Date.now();
  if (wait > 0) throw new Error(`Too many failed attempts. Try again in ${Math.ceil(wait / 1000)} s.`);
  let raw;
  try { raw = await unwrapWith(password); }
  catch (e) {
    META.failed = (META.failed || 0) + 1;
    if (META.failed >= 5) META.lockUntil = Date.now() + Math.min(30000 * 2 ** (META.failed - 5), 3600000);
    await kvPut('meta', META);
    throw new Error(META.failed >= 5 ? `Wrong password. Unlock is paused (${META.failed} failed attempts).` : `Wrong password (${META.failed} failed attempt${META.failed > 1 ? 's' : ''}).`);
  }
  KEY = await importDEK(raw); raw.fill(0);
  const rec = await kvGet('db');
  S = rec ? JSON.parse(dec.decode(await aesDec(KEY, unb64(rec.iv), unb64(rec.ct)))) : emptyDB();
  migrate(S);
  const failed = META.failed || 0;
  META.failed = 0; META.lockUntil = 0; META.lastUnlock = nowISO(); await kvPut('meta', META);
  audit('Unlocked', 'vault', '', '', failed ? `${failed} failed attempt(s) before this unlock` : '');
  saveSoon();
}

async function verifyPassword(pw) { try { await unwrapWith(pw); return true; } catch { return false; } }

async function changePassword(oldPw, newPw) {
  const raw = await unwrapWith(oldPw);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKEK(newPw, salt, PBKDF2_ITER);
  const w = await aesEnc(kek, raw); raw.fill(0);
  Object.assign(META, { salt: b64(salt), iter: PBKDF2_ITER, wIv: b64(w.iv), wrapped: b64(w.ct), pwChanged: nowISO() });
  await kvPut('meta', META);
  audit('Password changed', 'vault', '', '', '');
}

function lockVault() { KEY = null; S = null; for (const u of Object.values(URLS)) URL.revokeObjectURL(u); URLS = {}; }

let _saveT = null;
function saveSoon() { clearTimeout(_saveT); _saveT = setTimeout(() => saveNow().catch(e => toast('Save failed: ' + e.message)), 250); }
async function saveNow() {
  if (!KEY || !S) return;
  S.updated = nowISO();
  const r = await aesEnc(KEY, enc.encode(JSON.stringify(S)));
  await kvPut('db', { iv: b64(r.iv), ct: b64(r.ct), at: S.updated });
}

/* ---------- encrypted file blobs ---------- */
let URLS = {};
async function putBlob(id, buf) { const r = await aesEnc(KEY, buf); await idbOp('blobs', 'readwrite', s => s.put({ iv: r.iv, ct: r.ct }, id)); }
async function getBlob(id) { const r = await idbOp('blobs', 'readonly', s => s.get(id)); if (!r) return null; return aesDec(KEY, r.iv, r.ct); }
async function delBlob(id) { await idbOp('blobs', 'readwrite', s => s.delete(id)); if (URLS[id]) { URL.revokeObjectURL(URLS[id]); delete URLS[id]; } }
async function blobURL(f) {
  if (URLS[f.id]) return URLS[f.id];
  const buf = await getBlob(f.id); if (!buf) return null;
  return (URLS[f.id] = URL.createObjectURL(new Blob([buf], { type: f.mime || 'application/octet-stream' })));
}

/* ---------- database ---------- */
function emptyDB() {
  return {
    schema: 1, created: nowISO(), updated: nowISO(),
    settings: {
      userName: 'Vault owner', baseCurrency: 'EUR', fx: { EUR: 1 }, fxDate: '', autoLockMin: 5,
      valuationMaxAgeMonths: 36, metalMaxAgeMonths: 12, renewalWarnDays: 60, appraisalThreshold: 5000,
      backupReminderDays: 30, csvDelimiter: ';', theme: 'auto', revealNeedsPassword: true
    },
    people: [], locations: [], policies: [], items: [], valuations: [], verifications: [], files: [],
    audit: [], imports: [], backups: [], counters: {}
  };
}
function migrate(db) {
  const d = emptyDB();
  for (const k of Object.keys(d)) if (db[k] === undefined) db[k] = d[k];
  db.settings = Object.assign(d.settings, db.settings || {});
}

function audit(action, entity, ref, prev, next, field = '') {
  if (!S) return;
  S.audit.push({ id: uid(), ts: nowISO(), user: S.settings?.userName || 'owner', action, entity, ref, field, prev: prev == null ? '' : String(prev), next: next == null ? '' : String(next) });
  if (S.audit.length > 20000) S.audit.splice(0, S.audit.length - 20000);
}

/* ---------- lookups ---------- */
const byId = (arr, id) => arr.find(x => x.id === id);
const person = id => byId(S.people, id);
const loc = id => byId(S.locations, id);
const policy = id => byId(S.policies, id);
const item = id => byId(S.items, id);
const personName = id => person(id)?.name || '';
const locName = id => loc(id)?.name || '';
const activeItems = () => S.items.filter(i => !i.deleted);
const catName = c => SCHEMA.categories[c]?.name || c || '—';
const itemFiles = (it, kind) => S.files.filter(f => f.itemId === it.id && (!kind || f.kind === kind));
const isLocker = l => l && l.type === 'Bank locker';

function nextId(cat, year = new Date().getFullYear()) {
  const pre = `${cat}-${year}-`;
  let max = S.counters[pre] || 0;
  for (const i of S.items) if (i.id.startsWith(pre)) { const n = parseInt(i.id.slice(pre.length), 10); if (n > max) max = n; }
  S.counters[pre] = max + 1;
  return pre + String(max + 1).padStart(5, '0');
}

/* ---------- money & dates ---------- */
function fx(v, cur) {
  if (v == null || v === '' || isNaN(v)) return null;
  const base = S.settings.baseCurrency; cur = cur || base;
  if (cur === base) return +v;
  const r = S.settings.fx[cur]; // 1 unit of cur = r units of base
  return r ? +v * r : null;
}
function money(v, cur) {
  if (v == null || v === '' || isNaN(v)) return '—';
  cur = cur || S?.settings.baseCurrency || 'EUR';
  try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v); }
  catch { return `${(+v).toLocaleString(LOCALE)} ${cur}`; }
}
const moneyBase = v => money(v, S.settings.baseCurrency);
function fmtDate(iso) { if (!iso) return '—'; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso; }
function fmtTs(iso) { if (!iso) return '—'; const d = new Date(iso); return `${fmtDate(iso.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function monthsSince(iso) { if (!iso) return Infinity; return (Date.now() - new Date(iso).getTime()) / (30.44 * 864e5); }
function daysUntil(iso) { if (!iso) return Infinity; return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5); }
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function mask(v) { if (!v) return '—'; v = String(v); return v.length <= 4 ? '****' : '******' + v.slice(-4); }
function karatFromPurity(p) { p = +p; if (!p) return ''; const k = Math.round(p / 1000 * 24 * 10) / 10; return `${p} / ${k}K`; }

/* ---------- valuation logic ---------- */
const CURRENT_TYPES = ['Market', 'Appraised', 'Estimated'];
const INSURE_TYPES = ['Insurance', 'Replacement'];
function itemValuations(it) {
  const list = S.valuations.filter(v => v.itemId === it.id).slice();
  if (it.purchasePrice !== '' && it.purchasePrice != null && !list.some(v => v.type === 'Purchase'))
    list.push({ id: 'purchase-' + it.id, itemId: it.id, type: 'Purchase', value: +it.purchasePrice, currency: it.currency, date: it.purchaseDate || it.acquiredDate || '', source: it.invoiceNo ? `Invoice ${it.invoiceNo}` : 'Purchase record', virtual: true });
  return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
function latestOf(it, types) { const l = itemValuations(it).filter(v => types.includes(v.type)); return l[l.length - 1] || null; }
function itemVals(it) {
  const cur = latestOf(it, CURRENT_TYPES), ins = latestOf(it, INSURE_TYPES);
  const pv = it.purchasePrice !== '' && it.purchasePrice != null ? +it.purchasePrice : null;
  return {
    purchase: pv, purchaseBase: fx(pv, it.currency),
    current: cur, currentBase: cur ? fx(cur.value, cur.currency) : fx(pv, it.currency),
    insurance: ins, insuranceBase: ins ? fx(ins.value, ins.currency) : null,
    lastValDate: cur?.date || ''
  };
}
/** The value an insurer would be asked to pay: insurance/replacement value, else current value. */
const exposure = it => { const v = itemVals(it); return v.insuranceBase ?? v.currentBase ?? 0; };
const isMetalItem = it => ['GLD', 'COI'].includes(it.cat) || (it.cat === 'JWL' && (it.details?.metalType === 'Gold' || it.details?.metalType === 'Platinum'));
function valuationOutdated(it) {
  const v = latestOf(it, CURRENT_TYPES); if (!v) return true;
  return monthsSince(v.date) > (isMetalItem(it) ? S.settings.metalMaxAgeMonths : S.settings.valuationMaxAgeMonths);
}
function metalValue(it) {
  const d = it.details || {}; const w = +d.netMetalWeight || 0, p = +d.purity || 0, pr = +d.metalPriceCurrent || 0;
  if (!w || !p || !pr) return null;
  return { fine: w * p / 1000, value: w * p / 1000 * pr };
}

/* ---------- documentation completeness ---------- */
const PURCHASE_DOCS = ['Purchase invoice', 'Receipt', 'Bank statement'];
const CERT_DOCS = ['Certificate', 'Authenticity certificate', 'Appraisal'];
function hasDoc(it, types) { return itemFiles(it, 'doc').some(f => types.includes(f.docType)); }
function isWitnessed(it) { return S.verifications.some(v => (v.itemIds || []).includes(it.id)); }
function itemPolicies(it) {
  const out = []; if (it.policyId && policy(it.policyId)) out.push(policy(it.policyId));
  for (const p of S.policies) if (p.locationId && p.locationId === it.locationId && !out.includes(p)) out.push(p);
  return out;
}
function itemScore(it) {
  const checks = [];
  const add = (label, weight, got, missing) => checks.push({ label, weight, got, ok: got >= weight, missing: got < weight ? missing : '' });
  add('Basic information', 10, (it.name ? 4 : 0) + (it.cat ? 3 : 0) + (it.description ? 3 : 0), 'Add a description');
  add('Ownership', 10, (it.ownerId ? 7 : 0) + (it.acquisition ? 3 : 0), !it.ownerId ? 'Owner missing' : 'Acquisition method missing');
  const purchased = !it.acquisition || it.acquisition === 'Purchased';
  if (purchased) {
    const data = (it.purchasePrice !== '' && it.purchasePrice != null ? 4 : 0) + (it.purchaseDate ? 3 : 0);
    const doc = hasDoc(it, PURCHASE_DOCS) ? 8 : 0;
    add('Purchase evidence', 15, data + doc, doc ? 'Purchase price/date missing' : 'Invoice / receipt not uploaded');
  } else {
    const doc = hasDoc(it, ['Ownership document', 'Other evidence', 'Certificate', 'Appraisal']) ? 8 : 0;
    add('Acquisition evidence', 15, (it.acquiredDate ? 7 : 0) + doc, doc ? 'Date acquired missing' : 'No ownership / inheritance document');
  }
  const np = itemFiles(it, 'photo').length;
  add('Photographs', 15, np >= 3 ? 15 : np >= 1 ? 10 : 0, np ? 'Fewer than 3 photographs' : 'No photograph');
  if (SCHEMA.categories[it.cat]?.certExpected) {
    const c = hasDoc(it, CERT_DOCS) ? 10 : (it.details?.certNumber || it.details?.assayCert) ? 5 : 0;
    add('Certificate', 10, c, c ? 'Certificate number recorded but no document' : 'No certificate / appraisal');
  } else add('Certificate', 10, 10, '');
  const v = latestOf(it, CURRENT_TYPES);
  add('Valuation', 15, !v ? 0 : valuationOutdated(it) ? 7 : 15, !v ? 'No current valuation' : 'Valuation outdated');
  const pols = itemPolicies(it), iv = latestOf(it, INSURE_TYPES);
  add('Insurance', 10, (pols.length ? 5 : 0) + (iv ? 5 : 0), !pols.length ? 'Not linked to an insurance policy' : 'No insurance / replacement value');
  add('Storage location', 10, it.locationId ? 10 : 0, 'Storage location missing');
  add('Witness verification', 5, isWitnessed(it) ? 5 : 0, 'Not witnessed / verified');
  const score = Math.round(checks.reduce((a, c) => a + c.got, 0));
  return { score, checks, missing: checks.filter(c => !c.ok).map(c => c.missing) };
}
function scoreBar(s) { const cls = s >= 85 ? '' : s >= 60 ? 'mid' : 'low'; return `<span class="score"><span class="bar ${cls}"><i style="width:${s}%"></i></span><b>${s}%</b></span>`; }

/* ---------- insurance analysis ---------- */
const VALUABLE_CATS = ['JWL', 'GLD', 'DIA', 'WAT', 'COI', 'ART', 'ANT'];
function policyItems(p) { return activeItems().filter(it => it.policyId === p.id || (p.locationId && it.locationId === p.locationId)); }
function safeCertified(it) { const l = loc(it.locationId); return !!l && (isLocker(l) || (l.safe && l.safe.certified)); }
function policyAnalysis(p) {
  const items = policyItems(p);
  const total = items.reduce((a, it) => a + exposure(it), 0);
  const coverage = fx(p.coverage, p.currency);
  const checks = []; // {sev:'bad'|'warn'|'ok', text}
  const lim = (label, cats, limit, filter = () => true) => {
    if (!limit) return;
    const lb = fx(limit, p.currency); const sel = items.filter(it => cats.includes(it.cat) && filter(it));
    const sum = sel.reduce((a, it) => a + exposure(it), 0);
    checks.push(sum > lb ? { sev: 'bad', text: `${label}: ${moneyBase(sum)} exceeds limit ${money(limit, p.currency)} (gap ${moneyBase(sum - lb)})` }
      : { sev: 'ok', text: `${label}: ${moneyBase(sum)} within limit ${money(limit, p.currency)}` });
  };
  let status = 'n/a', ratio = null;
  const household = /household|hausrat/i.test(p.type || '');
  if (coverage != null && total > 0) {
    ratio = coverage / total;
    status = ratio < 1 ? 'Under-insured' : ratio <= 1.3 || household ? 'Adequately insured' : 'Potentially over-insured';
  } else if (!items.length) status = 'No items linked';
  if (household && p.valuablesPct) {
    const vl = coverage * (+p.valuablesPct / 100);
    const sum = items.filter(it => VALUABLE_CATS.includes(it.cat)).reduce((a, it) => a + exposure(it), 0);
    checks.push(sum > vl ? { sev: 'bad', text: `Valuables sub-limit (${p.valuablesPct}% of sum insured = ${moneyBase(vl)}) exceeded by ${moneyBase(sum - vl)}` }
      : { sev: 'ok', text: `Valuables ${moneyBase(sum)} within ${p.valuablesPct}% sub-limit (${moneyBase(vl)})` });
    if (sum > vl && status !== 'Under-insured') status = 'Under-insured';
  }
  lim('Valuables outside a certified safe / locker', VALUABLE_CATS, p.outsideSafeLimit, it => !safeCertified(it));
  lim('Jewellery, gemstones & watches', ['JWL', 'DIA', 'WAT'], p.jewelleryLimit);
  lim('Gold, bullion & coins', ['GLD', 'COI'], p.goldLimit);
  lim('Art & antiques', ['ART', 'ANT'], p.artLimit);
  if (p.itemLimit) {
    const over = items.filter(it => exposure(it) > fx(p.itemLimit, p.currency));
    if (over.length) checks.push({ sev: 'bad', text: `${over.length} item(s) above the per-item limit of ${money(p.itemLimit, p.currency)}: ${over.map(i => i.id).join(', ')}` });
  }
  const lockerItems = items.filter(it => isLocker(loc(it.locationId)));
  if (lockerItems.length && !p.lockerCoverage) checks.push({ sev: 'warn', text: `${lockerItems.length} linked item(s) are in a bank locker but the policy is not marked as covering locker contents` });
  if (p.lockerCoverage && p.lockerLimit) lim('Bank locker contents', SCHEMA.categories ? Object.keys(SCHEMA.categories) : [], p.lockerLimit, it => isLocker(loc(it.locationId)));
  const d = daysUntil(p.renewal);
  if (d < 0) checks.push({ sev: 'bad', text: `Policy renewal date passed ${fmtDate(p.renewal)}` });
  else if (d <= S.settings.renewalWarnDays) checks.push({ sev: 'warn', text: `Renewal due in ${d} days (${fmtDate(p.renewal)})` });
  const noDoc = items.filter(it => !hasDoc(it, PURCHASE_DOCS) && !hasDoc(it, CERT_DOCS));
  if (noDoc.length) checks.push({ sev: 'warn', text: `${noDoc.length} linked item(s) have neither invoice nor certificate/appraisal` });
  const noApp = items.filter(it => exposure(it) >= S.settings.appraisalThreshold && !latestOf(it, ['Appraised']) && !hasDoc(it, ['Appraisal']));
  if (noApp.length) checks.push({ sev: 'warn', text: `${noApp.length} item(s) ≥ ${moneyBase(S.settings.appraisalThreshold)} without a professional appraisal` });
  const outd = items.filter(valuationOutdated);
  if (outd.length) checks.push({ sev: 'warn', text: `${outd.length} item(s) with missing or outdated valuation` });
  const unconv = items.filter(it => { const v = itemVals(it); return (v.insurance && v.insuranceBase == null) || (v.current && v.currentBase == null); });
  if (unconv.length) checks.push({ sev: 'warn', text: `${unconv.length} item(s) excluded from totals: missing exchange rate` });
  return { items, total, coverage, ratio, status, checks, gap: coverage != null ? total - coverage : null };
}
function statusClass(s) { return s === 'Under-insured' ? 'bad' : s === 'Adequately insured' ? 'ok' : s === 'Potentially over-insured' ? 'warn' : ''; }

/* ---------- alerts ---------- */
function computeAlerts() {
  const A = []; const items = activeItems();
  const add = (sev, text, kind, ids = []) => { if (ids === null || ids.length || kind.startsWith('sys')) A.push({ sev, text, kind, ids }); };
  for (const p of S.policies) {
    const d = daysUntil(p.renewal);
    if (d < 0) add('bad', `Insurance policy ${p.insurer} expired / renewal passed (${fmtDate(p.renewal)})`, 'sys-policy');
    else if (d <= S.settings.renewalWarnDays) add('warn', `Insurance renewal approaching: ${p.insurer} in ${d} days`, 'sys-policy');
    const an = policyAnalysis(p);
    if (an.status === 'Under-insured') add('bad', `${p.insurer}: under-insured — check limits and sum insured`, 'sys-policy');
  }
  for (const l of S.locations) if (isLocker(l)) {
    const contents = items.filter(i => i.locationId === l.id); const val = contents.reduce((a, i) => a + exposure(i), 0);
    if (l.locker?.nextReview && daysUntil(l.locker.nextReview) < 0) add('warn', `Locker inventory review overdue: ${l.name}`, 'sys-locker');
    const bi = fx(l.locker?.bankInsured, l.locker?.bankInsuredCurrency);
    if (bi != null && val > bi && !S.policies.some(p => p.lockerCoverage)) add('bad', `${l.name}: contents ${moneyBase(val)} exceed bank-provided cover ${moneyBase(bi)} and no own policy covers locker contents`, 'sys-locker');
  }
  add('warn', 'Valuation outdated or missing', 'outdated', items.filter(valuationOutdated).map(i => i.id));
  add('warn', 'Missing invoice / receipt', 'noinvoice', items.filter(i => (!i.acquisition || i.acquisition === 'Purchased') && !hasDoc(i, PURCHASE_DOCS)).map(i => i.id));
  add('warn', 'Missing photograph', 'nophoto', items.filter(i => !itemFiles(i, 'photo').length).map(i => i.id));
  add('warn', 'Missing certificate / appraisal', 'nocert', items.filter(i => SCHEMA.categories[i.cat]?.certExpected && !hasDoc(i, CERT_DOCS)).map(i => i.id));
  add('bad', 'Missing ownership information', 'noowner', items.filter(i => !i.ownerId).map(i => i.id));
  add('warn', 'Missing witness verification', 'nowitness', items.filter(i => !isWitnessed(i)).map(i => i.id));
  add('bad', 'Not covered by any insurance policy', 'noins', items.filter(i => !itemPolicies(i).length).map(i => i.id));
  add('warn', 'Missing insurance documentation (no insurance/replacement value)', 'noinsval', items.filter(i => !latestOf(i, INSURE_TYPES)).map(i => i.id));
  add('warn', `High-value item without appraisal (≥ ${moneyBase(S.settings.appraisalThreshold)})`, 'noappraisal', items.filter(i => exposure(i) >= S.settings.appraisalThreshold && !latestOf(i, ['Appraised']) && !hasDoc(i, ['Appraisal'])).map(i => i.id));
  add('warn', 'Missing storage location', 'noloc', items.filter(i => !i.locationId).map(i => i.id));
  const missingFx = new Set(); for (const v of S.valuations) if (v.currency && v.currency !== S.settings.baseCurrency && !S.settings.fx[v.currency]) missingFx.add(v.currency);
  for (const i of items) if (i.currency && i.currency !== S.settings.baseCurrency && !S.settings.fx[i.currency]) missingFx.add(i.currency);
  if (missingFx.size) add('bad', `Exchange rate missing for ${[...missingFx].join(', ')} — those values are excluded from totals`, 'sys-fx');
  const lastB = S.backups[S.backups.length - 1];
  if (items.length && (!lastB || monthsSince(lastB.ts) * 30.44 > S.settings.backupReminderDays)) add(lastB ? 'warn' : 'bad', lastB ? `Last encrypted backup ${fmtDate(lastB.ts.slice(0, 10))} — backup is due` : 'No encrypted backup has been made yet', 'sys-backup');
  return A;
}
const ALERT_FILTERS = { outdated: valuationOutdated };
