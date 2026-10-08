/* =====================================================================
   Valuables Vault — reports, import/export, backup/restore, sample data, actions, boot
   ===================================================================== */
const DETAIL_COLS = (() => { const m = new Map(); for (const [g, G] of Object.entries(SCHEMA.groups)) for (const f of G.fields) if (!m.has(f.k)) m.set(f.k, { ...f, k: 'details.' + f.k, label: `${G.title}: ${f.label}` }); return [...m.values()]; })();
const ALL_COLS = [...SCHEMA.basicColumns, ...DETAIL_COLS];
const SENSITIVE_DETAIL = new Set(DETAIL_COLS.filter(c => c.sensitive).map(c => c.k));

/* ---------- flatten item for export ---------- */
function flatItem(it, confidential) {
  const v = itemVals(it); const o = {};
  for (const c of SCHEMA.basicColumns) o[c.label] = '';
  Object.assign(o, {
    'Inventory ID': it.id, 'Item name': it.name, 'Category code': it.cat, 'Subcategory': it.subcat, 'Description': it.description, 'Brand': it.brand, 'Manufacturer': it.manufacturer, 'Model': it.model,
    'Serial number': it.serial, 'Identification number': it.idNumber, 'Date acquired': it.acquiredDate, 'Purchase date': it.purchaseDate, 'Purchase location': it.purchaseLocation, 'Seller / dealer': it.seller,
    'Country of purchase': it.purchaseCountry, 'Invoice number': it.invoiceNo, 'Purchase price': it.purchasePrice, 'Currency': it.currency, 'Owner': personName(it.ownerId),
    'Co-owners (; separated)': (it.coOwnerIds || []).map(personName).join('; '), 'Beneficiaries (; separated)': (it.beneficiaryIds || []).map(personName).join('; '),
    'Ownership %': it.ownershipPct, 'Ownership type': it.ownershipType, 'Acquisition method': it.acquisition, 'Storage location': locName(it.locationId), 'Insurance policy (insurer)': policy(it.policyId)?.insurer || '',
    'Current estimated value': v.current?.value ?? '', 'Current value date': v.current?.date ?? '', 'Current value source': v.current ? `${v.current.type} – ${v.current.source || ''}` : '',
    'Insurance value': v.insurance?.value ?? '', 'Insurance value date': v.insurance?.date ?? '', 'Notes': it.notes
  });
  for (const c of DETAIL_COLS) { const val = it.details?.[c.k.slice(8)] ?? ''; o[c.label] = SENSITIVE_DETAIL.has(c.k) && !confidential && val ? mask(val) : val; }
  return o;
}
function toCSV(rows, delim) {
  if (!rows.length) return '';
  const heads = Object.keys(rows[0]); const q = v => { v = v == null ? '' : String(v); return /[";,\n\r]/.test(v) || v.includes(delim) ? `"${v.replace(/"/g, '""')}"` : v; };
  return '﻿' + [heads.map(q).join(delim), ...rows.map(r => heads.map(h => q(r[h])).join(delim))].join('\r\n');
}
function download(name, data, mime) { return Platform.save(name, data, mime); }
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/* ---------- Import / Export view ---------- */
VIEWS.import = () => `<h1>Import / Export</h1>
  <div class="grid g2">
  <div class="card"><h3>Export</h3><form id="expf"><div class="fields">
    <label class="f">Scope${sel('scope', [['all', 'Complete inventory'], ['selected', `Selected items (${SEL.size})`], ['cat', 'Category'], ['owner', 'Owner'], ['loc', 'Location'], ['policy', 'Insurance policy']], 'all', 'id="expscope"')}</label>
    <label class="f" id="expvalwrap">Value<select name="val" id="expval"></select></label>
    <label class="f">Format${sel('fmt', [['xlsx', 'Excel workbook (9 sheets)'], ['csv', 'CSV — detailed inventory'], ['csv-val', 'CSV — valuation history'], ['csv-ins', 'CSV — insurance analysis'], ['csv-loc', 'CSV — storage locations']], 'xlsx')}</label></div>
    <label class="row small" style="margin-top:10px"><input type="checkbox" class="chk" name="confidential"> Include confidential fields unmasked (locker numbers, policy numbers, document numbers, ID references)</label>
    <p class="small muted">Exports are <b>not encrypted</b>. Store them on an encrypted drive and delete them when no longer needed. Photos and documents are listed, not embedded — use Backup for a complete copy.</p>
    <button class="btn pri" type="submit">Export</button></form></div>
  <div class="card"><h3>Import from CSV or Excel</h3><p class="small muted">Use the template (same columns as the export). Column names are matched automatically; you can adjust the mapping. Dates as YYYY-MM-DD or DD.MM.YYYY; numbers as 4500.00 or 4.500,00.</p>
    <div class="row"><input type="file" id="impfile" accept=".csv,.xlsx,.xls,text/csv"><button class="btn" data-act="dl-template">Download CSV template</button></div>
    <h4 style="margin-top:16px">Import history</h4>
    <table><thead><tr><th>Date</th><th>File</th><th class="num">Created</th><th class="num">Updated</th><th class="num">Skipped</th><th class="num">Errors</th></tr></thead><tbody>
    ${S.imports.slice().reverse().map(h => `<tr><td class="small">${fmtTs(h.ts)}</td><td class="small">${esc(h.file)}</td><td class="num">${h.created}</td><td class="num">${h.updated}</td><td class="num">${h.skipped}</td><td class="num">${h.errors}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No imports yet</td></tr>'}</tbody></table></div></div>
  <div id="impwiz"></div>`;
AFTER.import = () => {
  const syncVal = () => {
    const s = $('#expscope').value; const opts = s === 'cat' ? catOpts() : s === 'owner' ? S.people.map(p => [p.id, p.name]) : s === 'loc' ? S.locations.map(l => [l.id, l.name]) : s === 'policy' ? S.policies.map(p => [p.id, p.insurer]) : [];
    $('#expvalwrap').style.display = opts.length ? '' : 'none'; $('#expval').innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  };
  $('#expscope').onchange = syncVal; syncVal();
  $('#expf').onsubmit = async e => {
    e.preventDefault(); const o = formObj(e.target); let items = activeItems();
    if (o.scope === 'selected') items = items.filter(i => SEL.has(i.id)); if (o.scope === 'cat') items = items.filter(i => i.cat === o.val);
    if (o.scope === 'owner') items = items.filter(i => i.ownerId === o.val || (i.coOwnerIds || []).includes(o.val)); if (o.scope === 'loc') items = items.filter(i => i.locationId === o.val);
    if (o.scope === 'policy') items = policyItems(policy(o.val) || {});
    if (!items.length && o.fmt !== 'csv-loc' && o.fmt !== 'csv-ins') return toast('Nothing to export for this selection.');
    if (o.confidential && !(await askPassword('Export confidential data', 'Unmasked locker, policy and document numbers will be written to an unencrypted file.'))) return;
    await doExport(items, o.fmt, !!o.confidential);
  };
  $('#impfile').onchange = e => e.target.files[0] && startImport(e.target.files[0]);
};
async function doExport(items, fmt, conf) {
  const d = S.settings.csvDelimiter;
  if (fmt === 'csv') download(`inventory-${stamp()}.csv`, toCSV(items.map(i => flatItem(i, conf)), d), 'text/csv');
  else if (fmt === 'csv-val') download(`valuations-${stamp()}.csv`, toCSV(valRows(items), d), 'text/csv');
  else if (fmt === 'csv-ins') download(`insurance-${stamp()}.csv`, toCSV(insRows(conf), d), 'text/csv');
  else if (fmt === 'csv-loc') download(`locations-${stamp()}.csv`, toCSV(locRows(conf), d), 'text/csv');
  else await exportXLSX(items, conf);
  audit('Export performed', 'export', fmt, '', `${items.length} item(s)${conf ? ', confidential included' : ''}`); saveSoon(); toast('Export created');
}
const valRows = items => items.flatMap(it => itemValuations(it).map(v => ({ 'Inventory ID': it.id, 'Item': it.name, 'Date': v.date, 'Valuation type': v.type, 'Value': v.value, 'Currency': v.currency, [`Value (${S.settings.baseCurrency})`]: fx(v.value, v.currency) ?? '', 'Source': v.source || '', 'Valuer': v.valuer || '', 'Document': v.docId ? byId(S.files, v.docId)?.name || '' : '' })));
const insRows = conf => S.policies.map(p => { const a = policyAnalysis(p); return { 'Insurer': p.insurer, 'Policy no.': conf ? p.number || '' : mask(p.number), 'Type': p.type, 'Holder': personName(p.holderId), 'Sum insured': p.coverage, 'Currency': p.currency, 'Start': p.start, 'Renewal': p.renewal, 'Deductible': p.deductible, 'Items': a.items.length, [`Covered value (${S.settings.baseCurrency})`]: Math.round(a.total), 'Cover ratio %': a.ratio != null ? Math.round(a.ratio * 100) : '', 'Status': a.status, 'Findings': a.checks.filter(c => c.sev !== 'ok').map(c => c.text).join(' | ') }; });
const locRows = conf => S.locations.map(l => { const c = activeItems().filter(i => i.locationId === l.id); const L = l.locker || {}; return { 'Location': l.name, 'Type': l.type, 'Address': l.address || '', 'Certified safe': l.safe?.certified ? 'yes' : '', 'Bank': L.bank || '', 'Branch': L.branch || '', 'Locker no.': conf ? L.number || '' : mask(L.number), 'Agreement ref.': conf ? L.agreementRef || '' : mask(L.agreementRef), 'Holders': (L.holderIds || []).map(personName).join('; '), 'Bank cover': L.bankInsured || '', 'Last inspection': L.lastInspection || '', 'Next review': L.nextReview || '', 'Items': c.length, [`Value (${S.settings.baseCurrency})`]: Math.round(c.reduce((a, i) => a + exposure(i), 0)) }; });

async function exportXLSX(items, conf) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Valuables Vault'; wb.created = new Date();
  const NAVY = 'FF1F3A5F', base = S.settings.baseCurrency;
  const sheet = (name, rows, opts = {}) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    if (!rows.length) { ws.addRow(['(no data)']); return ws; }
    const heads = Object.keys(rows[0]); ws.columns = heads.map(h => ({ header: h, key: h, width: Math.min(48, Math.max(11, h.length + 2, ...rows.slice(0, 200).map(r => String(r[h] ?? '').length + 2))) }));
    rows.forEach(r => ws.addRow(r));
    const hr = ws.getRow(1); hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; hr.alignment = { vertical: 'middle', wrapText: true }; hr.height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: heads.length } };
    heads.forEach((h, i) => { if (/value|price|sum insured|deductible|cover\b|bank cover/i.test(h) && !/date|source|type|%/i.test(h)) ws.getColumn(i + 1).numFmt = '#,##0.00'; });
    ws.eachRow((row, n) => { if (n > 1 && n % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3EF' } }; });
    (opts.status || []).forEach(([col, map]) => ws.getColumn(col).eachCell((c, n) => { if (n > 1 && map[c.value]) c.font = { bold: true, color: { argb: map[c.value] } }; }));
    return ws;
  };
  // 1 Overview
  const ov = wb.addWorksheet('Inventory Overview');
  ov.columns = [{ width: 34 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 12 }];
  ov.addRow(['Valuables Inventory — Overview']).font = { size: 16, bold: true, color: { argb: NAVY } };
  ov.addRow([`Owner: ${S.settings.userName} · Exported ${fmtTs(nowISO())} · Base currency ${base}${conf ? ' · CONTAINS CONFIDENTIAL DATA' : ''}`]).font = { italic: true, color: { argb: 'FF7B8496' } };
  ov.addRow([]);
  const tot = f => items.reduce((a, i) => a + (f(itemVals(i)) || 0), 0);
  const h = ov.addRow(['Measure', `Value (${base})`]); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } });
  [['Items', items.length], ['Total purchase value', tot(v => v.purchaseBase)], ['Total current estimated value', tot(v => v.currentBase)], ['Total insurance value', tot(v => v.insuranceBase)], ['Average documentation score %', items.length ? Math.round(items.reduce((a, i) => a + itemScore(i).score, 0) / items.length) : 0]].forEach(r => ov.addRow(r).getCell(2).numFmt = '#,##0');
  ov.addRow([]); const h2 = ov.addRow(['Category', 'Items', `Purchase (${base})`, `Current (${base})`, `Insurance (${base})`]); h2.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h2.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } });
  for (const [k, c] of Object.entries(SCHEMA.categories)) { const sel = items.filter(i => i.cat === k); if (!sel.length) continue; const r = ov.addRow([c.name, sel.length, sel.reduce((a, i) => a + (itemVals(i).purchaseBase || 0), 0), sel.reduce((a, i) => a + (itemVals(i).currentBase || 0), 0), sel.reduce((a, i) => a + (itemVals(i).insuranceBase || 0), 0)]); [3, 4, 5].forEach(n => r.getCell(n).numFmt = '#,##0'); }
  ov.addRow([]); ov.addRow(['Market value ≠ insurance/replacement value. Values are as recorded by the owner; see Valuation History for sources.']).font = { italic: true, size: 9 };
  // 2-9
  sheet('Detailed Inventory', items.map(i => flatItem(i, conf)));
  sheet('Valuation History', valRows(items));
  sheet('Insurance Analysis', insRows(conf), { status: [[13, { 'Under-insured': 'FFB23A3A', 'Adequately insured': 'FF2F7D4F', 'Potentially over-insured': 'FF9A6A00' }]] });
  sheet('Storage Locations', locRows(conf));
  sheet('Ownership', items.map(it => ({ 'Inventory ID': it.id, 'Item': it.name, 'Owner': personName(it.ownerId), 'Ownership type': it.ownershipType || '', 'Ownership %': it.ownershipPct ?? '', 'Co-owners': (it.coOwnerIds || []).map(personName).join('; '), 'Beneficiaries': (it.beneficiaryIds || []).map(personName).join('; '), 'Acquisition': it.acquisition || '', 'Date acquired': it.acquiredDate || it.purchaseDate || '' })));
  sheet('Documents', S.files.filter(f => items.some(i => i.id === f.itemId)).map(f => ({ 'Inventory ID': f.itemId, 'Kind': f.kind, 'Type / view': f.kind === 'photo' ? f.view : f.docType, 'File name': f.name, 'Date': f.kind === 'photo' ? f.photoDate : f.docDate || f.uploadDate, 'Uploaded': f.uploadDate, 'Size (KB)': Math.round(f.size / 1024), 'Caption / reference': f.caption || f.ref || '', 'SHA-256': f.sha256 })));
  sheet('Missing Information', items.map(i => { const s = itemScore(i); return { 'Inventory ID': i.id, 'Item': i.name, 'Documentation %': s.score, 'Missing': s.missing.join('; ') }; }).filter(r => r.Missing));
  sheet('Change History', S.audit.slice().reverse().map(a => ({ 'Date/Time': fmtTs(a.ts), 'User': a.user, 'Action': a.action, 'Entity': a.entity, 'Ref': a.ref, 'Field': a.field, 'Previous value': a.prev, 'New value': a.next })));
  const buf = await wb.xlsx.writeBuffer();
  download(`valuables-inventory-${stamp()}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

/* ---------- import wizard ---------- */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function parseNum(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[^\d,.\-]/g, ''); if (!s) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (ld > -1 && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
  return s === '' ? NaN : +s;
}
function parseDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return valid(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s))) return valid(m[3], m[2], m[1]);
  return null;
  function valid(y, mo, d) { const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const t = new Date(iso + 'T00:00:00Z'); return !isNaN(t) && t.toISOString().slice(0, 10) === iso ? iso : null; }
}
let IMP = null;
async function startImport(file) {
  try {
    // CSV is read as plain text (raw) so that EU formats like 1.250,00 and 03.04.2019 reach our own parsers untouched
    const isCSV = /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv';
    const wb = isCSV ? XLSX.read((await file.text()).replace(/^\ufeff/, ''), { type: 'string', raw: true }) : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sn = wb.SheetNames.find(n => /detailed inventory|inventory import|inventory/i.test(n) && !/overview/i.test(n)) || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' }).filter(r => r.some(c => String(c).trim() !== ''));
    if (rows.length < 2) return toast('No data rows found.');
    let hi = rows.findIndex(r => r.some(c => /item name|inventory id/i.test(String(c)))); if (hi < 0) hi = 0;
    const headers = rows[hi].map(String); const data = rows.slice(hi + 1).filter(r => !String(r[0]).startsWith('#'));
    const map = {}; for (const c of ALL_COLS) { const i = headers.findIndex(h => norm(h) === norm(c.label) || norm(h) === norm(c.k) || norm(h) === norm(c.k.replace('details.', ''))); if (i > -1) map[c.k] = i; }
    IMP = { file: file.name, sheet: sn, headers, data, map, dupMode: 'skip' };
    renderImportMapping();
  } catch (e) { toast('Could not read file: ' + e.message); }
}
function renderImportMapping() {
  const w = $('#impwiz'); const used = ALL_COLS.filter(c => IMP.map[c.k] != null);
  w.innerHTML = `<div class="card" style="margin-top:14px"><div class="row between"><h2 style="margin:0">Import: ${esc(IMP.file)}</h2><span class="muted small">sheet "${esc(IMP.sheet)}" · ${IMP.data.length} rows · ${used.length} of ${IMP.headers.length} columns matched</span></div>
    <h3 style="margin-top:12px">1 · Column mapping</h3><div class="fields" id="mapf">${ALL_COLS.filter(c => IMP.map[c.k] != null || SCHEMA.basicColumns.includes(c)).map(c => `<label class="f"><span class="${c.required ? 'req' : ''}">${esc(c.label)}</span><select data-k="${c.k}"><option value="">— not imported —</option>${IMP.headers.map((h, i) => `<option value="${i}" ${IMP.map[c.k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="row" style="margin-top:10px"><label class="f" style="max-width:340px">If the Inventory ID already exists${sel('dup', [['skip', 'Skip the row'], ['update', 'Update the existing record'], ['new', 'Import as new item with a new ID']], IMP.dupMode, 'id="dupmode"')}</label><button class="btn" data-act="imp-validate">Validate & preview</button></div>
    <div id="imppreview"></div></div>`;
  $$('#mapf select').forEach(s => s.onchange = () => { if (s.value === '') delete IMP.map[s.dataset.k]; else IMP.map[s.dataset.k] = +s.value; });
  $('#dupmode').onchange = e => IMP.dupMode = e.target.value;
  w.scrollIntoView({ behavior: 'smooth' });
}
function importRowsValidate() {
  const out = []; const seenIds = new Set(), seenSerial = new Set();
  IMP.data.forEach((r, n) => {
    const get = k => IMP.map[k] != null ? r[IMP.map[k]] : ''; const errors = [], warns = []; const rec = { details: {} };
    for (const c of ALL_COLS) {
      let v = get(c.k); if (v === '' || v == null) continue;
      if (c.type === 'number') { const x = parseNum(v); if (isNaN(x)) { errors.push(`${c.label}: "${v}" is not a number`); continue; } v = x; }
      else if (c.type === 'date') { const x = parseDate(v); if (!x) { errors.push(`${c.label}: "${v}" is not a valid date`); continue; } v = x; }
      else v = v instanceof Date ? parseDate(v) : String(v).trim();
      if (c.k.startsWith('details.')) rec.details[c.k.slice(8)] = v; else rec[c.k] = v;
    }
    if (!rec.name) errors.push('Item name missing');
    rec.cat = String(rec.cat || '').toUpperCase(); if (!SCHEMA.categories[rec.cat]) { const byName = Object.entries(SCHEMA.categories).find(([, x]) => norm(x.name) === norm(rec.cat)); if (byName) rec.cat = byName[0]; else errors.push(`Category "${rec.cat}" unknown (use ${Object.keys(SCHEMA.categories).join(', ')})`); }
    rec.currency = String(rec.currency || S.settings.baseCurrency).toUpperCase(); if (!/^[A-Z]{3}$/.test(rec.currency)) errors.push(`Currency "${rec.currency}" invalid`);
    if (rec.ownershipPct !== undefined && (rec.ownershipPct < 0 || rec.ownershipPct > 100)) errors.push('Ownership % outside 0–100');
    if (rec.purchasePrice !== undefined && rec.purchasePrice < 0) errors.push('Negative purchase price');
    if (!rec.owner) warns.push('No owner'); if (rec.purchasePrice === undefined && (!rec.acquisition || rec.acquisition === 'Purchased')) warns.push('No purchase price');
    if (!rec.insuranceValue && !rec.policy) warns.push('No insurance information');
    let action = 'create';
    if (rec.id) {
      if (seenIds.has(rec.id)) { errors.push(`Inventory ID ${rec.id} appears twice in the file`); }
      seenIds.add(rec.id);
      if (!/^[A-Z]{3}-\d{4}-\d{5}$/.test(rec.id)) warns.push(`ID ${rec.id} does not follow CAT-YYYY-NNNNN; a new ID will be assigned`);
      else if (S.items.some(i => i.id === rec.id)) action = IMP.dupMode === 'skip' ? 'skip' : IMP.dupMode === 'update' ? 'update' : 'create-newid';
    }
    if (rec.serial) { const k = rec.serial.toLowerCase(); if (seenSerial.has(k)) warns.push('Serial number repeated in file'); seenSerial.add(k); const ex = S.items.find(i => !i.deleted && i.serial?.toLowerCase() === k && i.id !== rec.id); if (ex && action !== 'update') warns.push(`Serial number already used by ${ex.id}`); }
    out.push({ n: n + 1, rec, errors, warns, action: errors.length ? 'error' : action });
  });
  return out;
}
function importPreview() {
  const res = importRowsValidate(); IMP.res = res;
  const cnt = a => res.filter(r => r.action === a || (a === 'create' && r.action === 'create-newid')).length;
  $('#imppreview').innerHTML = `<h3 style="margin-top:16px">2 · Preview & validation</h3>
    <div class="row"><span class="pill ok">${cnt('create')} create</span><span class="pill info">${cnt('update')} update</span><span class="pill">${cnt('skip')} skip (duplicate)</span><span class="pill bad">${cnt('error')} with errors</span><span class="pill warn">${res.filter(r => r.warns.length).length} with warnings</span></div>
    <div class="tablewrap" style="margin-top:10px;max-height:380px"><table><thead><tr><th>Row</th><th>Action</th><th>Inventory ID</th><th>Item</th><th>Category</th><th class="num">Price</th><th>Issues</th></tr></thead><tbody>
    ${res.slice(0, 300).map(r => `<tr><td>${r.n}</td><td><span class="pill ${r.action === 'error' ? 'bad' : r.action === 'skip' ? '' : 'ok'}">${r.action}</span></td><td class="mono small">${esc(r.rec.id || 'new')}</td><td>${esc(r.rec.name)}</td><td>${esc(r.rec.cat)}</td><td class="num">${r.rec.purchasePrice !== undefined ? money(r.rec.purchasePrice, r.rec.currency) : ''}</td><td class="small">${r.errors.map(e => `<div class="status-u">${esc(e)}</div>`).join('')}${r.warns.map(e => `<div class="status-o">${esc(e)}</div>`).join('')}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px"><button class="btn pri" data-act="imp-run" ${res.some(r => ['create', 'create-newid', 'update'].includes(r.action)) ? '' : 'disabled'}>Import valid rows</button>${res.some(r => r.errors.length || r.warns.length) ? '<button class="btn" data-act="imp-errors">Download error report</button>' : ''}<span class="small muted">Rows with errors are not imported. Owners, locations and policies that don't exist yet are created by name.</span></div>`;
}
function importRun() {
  const res = IMP.res; let created = 0, updated = 0, skipped = 0;
  const findOrCreate = (arr, name, mk) => { if (!name) return ''; let x = arr.find(a => norm(a.name || a.insurer) === norm(name)); if (!x) { x = mk(name); arr.push(x); audit('Created', 'import', name, '', ''); } return x.id; };
  const personId = n => findOrCreate(S.people, n, name => ({ id: uid(), name, roles: ['Owner'] }));
  for (const r of res) {
    if (r.action === 'error' || r.action === 'skip') { skipped++; continue; }
    const x = r.rec; const it = r.action === 'update' ? item(x.id) : null; const before = it ? structuredClone(it) : null;
    const rec = { name: x.name, cat: x.cat, currency: x.currency };
    for (const k of ['subcat', 'description', 'brand', 'manufacturer', 'model', 'serial', 'idNumber', 'acquiredDate', 'purchaseDate', 'purchaseLocation', 'seller', 'purchaseCountry', 'invoiceNo', 'purchasePrice', 'ownershipPct', 'ownershipType', 'acquisition', 'notes']) if (x[k] !== undefined) rec[k] = x[k];
    if (x.owner) rec.ownerId = personId(x.owner);
    if (x.coOwners) rec.coOwnerIds = x.coOwners.split(';').map(s => s.trim()).filter(Boolean).map(personId);
    if (x.beneficiaries) rec.beneficiaryIds = x.beneficiaries.split(';').map(s => s.trim()).filter(Boolean).map(personId);
    if (x.location) rec.locationId = findOrCreate(S.locations, x.location, name => ({ id: uid(), name, type: /locker|schlie/i.test(name) ? 'Bank locker' : /safe|tresor/i.test(name) ? 'Home safe' : 'Home' }));
    if (x.policy) rec.policyId = findOrCreate(S.policies, x.policy, insurer => ({ id: uid(), insurer, currency: S.settings.baseCurrency, type: 'Other' }));
    rec.details = { ...(it?.details || {}), ...x.details };
    let target;
    if (it) { Object.assign(it, rec, { updated: nowISO() }); diffAudit(before, it); target = it; updated++; }
    else { const cat = rec.cat; const id = r.action === 'create' && x.id && /^[A-Z]{3}-\d{4}-\d{5}$/.test(x.id) && !S.items.some(i => i.id === x.id) ? x.id : nextId(cat); target = { ...rec, id, created: nowISO(), updated: nowISO(), coOwnerIds: rec.coOwnerIds || [], beneficiaryIds: rec.beneficiaryIds || [] }; S.items.push(target); audit('Created', 'item', id, '', `${rec.name} (import ${IMP.file})`); created++; }
    const addIfNew = (type, value, date, source) => { if (value === undefined || value === '') return; if (S.valuations.some(v => v.itemId === target.id && v.type === type && +v.value === +value && v.date === (date || todayISO()))) return; addValuation({ itemId: target.id, type, value: +value, currency: rec.currency, date: date || todayISO(), source: source || `Import ${IMP.file}` }); };
    addIfNew(/apprais/i.test(x.currentValueSource || '') ? 'Appraised' : /market/i.test(x.currentValueSource || '') ? 'Market' : 'Estimated', x.currentValue, x.currentValueDate, x.currentValueSource);
    addIfNew('Insurance', x.insuranceValue, x.insuranceValueDate);
  }
  const errors = res.filter(r => r.errors.length).length;
  S.imports.push({ ts: nowISO(), file: IMP.file, rows: res.length, created, updated, skipped, errors });
  audit('Import performed', 'import', IMP.file, '', `${created} created, ${updated} updated, ${skipped} skipped`);
  saveSoon(); toast(`Import finished: ${created} created, ${updated} updated, ${skipped} skipped`); IMP = null; go('import');
}

/* ---------- reports ---------- */
VIEWS.reports = () => `<h1>Reports</h1><p class="muted">Reports open as a print-ready page — use <b>Print → Save as PDF</b>. They contain confidential data: print only what you need and store PDFs securely.</p>
  <form id="repf" class="card"><div class="fields">
    <label class="f">Owner${sel('owner', [['', 'All owners'], ...S.people.map(p => [p.id, p.name])], '')}</label>
    <label class="f">Location${sel('loc', [['', 'All locations'], ...S.locations.map(l => [l.id, l.name])], '')}</label>
    <label class="f">Category${sel('cat', [['', 'All categories'], ...catOpts()], '')}</label></div>
    <div class="row" style="margin-top:10px"><label class="row small"><input type="checkbox" class="chk" name="photos" checked> Include photographs</label><label class="row small"><input type="checkbox" class="chk" name="conf"> Show confidential numbers unmasked</label></div></form>
  <div class="grid g3" style="margin-top:14px">
  ${[['inventory', 'Personal inventory report', 'Every item with photo, purchase details, current and insurance value, location.'], ['photo', 'Photo inventory report', 'All photographs per item with view, date and caption — evidence for claims.'],
  ['insurance', 'Insurance report', 'Insured values vs. policy cover, sub-limits, gaps and missing documentation.'], ['locker', 'Bank locker inventory', 'Printable list of each locker\'s contents with signature lines.'],
  ['estate', 'Estate / inheritance report', 'Assets by owner with beneficiaries, values and supporting documents.'], ['verification', 'Verification report', 'All witness records with signatures.'], ['missing', 'Missing information report', 'What to complete for each item.'], ['qr', 'QR labels', 'Labels with only the inventory reference.']]
    .map(([k, t, d]) => `<div class="card"><h3>${t}</h3><p class="small muted">${d}</p><button class="btn pri" data-act="report" data-kind="${k}">Create</button></div>`).join('')}</div>`;

function repFilter() { const f = $('#repf') ? formObj($('#repf')) : { photos: true }; let items = activeItems(); if (f.owner) items = items.filter(i => i.ownerId === f.owner || (i.coOwnerIds || []).includes(f.owner)); if (f.loc) items = items.filter(i => i.locationId === f.loc); if (f.cat) items = items.filter(i => i.cat === f.cat); return { items, f }; }
async function photoData(f, max = 900) { const buf = await getBlob(f.id); if (!buf) return ''; if (/heic|heif/i.test(f.mime)) return ''; return makeThumb(new Blob([buf], { type: f.mime }), max); }
const REP_CSS = `body{font:11pt/1.4 "Segoe UI",Arial,sans-serif;color:#1d2330;margin:0}main{padding:18mm 16mm}h1{font-size:19pt;margin:0 0 2mm;color:#1f3a5f}h2{font-size:13pt;margin:7mm 0 2mm;color:#1f3a5f;border-bottom:1px solid #d3cec4;padding-bottom:1mm}h3{font-size:11.5pt;margin:4mm 0 1mm}
  .meta{color:#555;font-size:9.5pt;margin-bottom:5mm}.conf{display:inline-block;border:1px solid #b23a3a;color:#b23a3a;padding:1px 6px;font-size:8.5pt;font-weight:600;letter-spacing:.05em}
  table{border-collapse:collapse;width:100%;font-size:9.5pt;margin:2mm 0}th,td{border-bottom:1px solid #e4e0d8;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2efe9;font-size:8.5pt;text-transform:uppercase;letter-spacing:.03em}td.n,th.n{text-align:right;white-space:nowrap}
  .item{page-break-inside:avoid;border:1px solid #e4e0d8;border-radius:4px;padding:4mm;margin:4mm 0;display:grid;grid-template-columns:52mm 1fr;gap:5mm}.item img{width:52mm;height:40mm;object-fit:cover;border-radius:3px;background:#f2efe9}
  .kv{display:grid;grid-template-columns:38mm 1fr;gap:1mm 4mm;font-size:9.5pt}.kv b{font-weight:600;color:#555}.ph{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.ph figure{margin:0;page-break-inside:avoid}.ph img{width:100%;height:45mm;object-fit:cover;border:1px solid #ddd}.ph figcaption{font-size:8.5pt;color:#444}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:14mm}.sig div{border-top:1px solid #333;padding-top:2mm;font-size:9pt}.bad{color:#b23a3a;font-weight:600}.ok{color:#2f7d4f;font-weight:600}.warn{color:#9a6a00;font-weight:600}
  .tot td{font-weight:700;border-top:2px solid #1d2330}.note{font-size:8.5pt;color:#666;margin-top:6mm}.qrs{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}.qrs div{border:1px dashed #aaa;padding:3mm;text-align:center;font:9pt monospace;page-break-inside:avoid}.qrs svg{width:30mm;height:30mm}
  @media print{.noprint{display:none}main{padding:0}@page{margin:14mm 12mm 16mm}}.noprint{position:sticky;top:0;background:#1f3a5f;color:#fff;padding:8px 16px;display:flex;gap:10px;align-items:center}.noprint button{padding:5px 12px;cursor:pointer}
  .rbrand{display:flex;justify-content:flex-end;align-items:center;gap:4mm;margin-top:8mm;padding-top:3mm;border-top:1px solid #e4e0d8;page-break-inside:avoid}.rbrand img{height:14mm;width:auto}.rbrand div{font-size:8.5pt;color:#555;text-align:right;line-height:1.4}.rbrand b{color:#1d2330}.rbrand a{color:#1f3a5f}`;
let REPWIN = null;
function reportHTML(title, body, toolbar) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${REP_CSS}</style></head><body>${toolbar ? `<div class="noprint"><b>${esc(title)}</b><span style="flex:1"></span><button onclick="print()">Print / Save as PDF</button><button onclick="close()">Close</button></div>` : ''}<main>
    <h1>${esc(title)}</h1><div class="meta">${esc(S.settings.userName)} · created ${fmtTs(nowISO())} · base currency ${S.settings.baseCurrency} · <span class="conf">CONFIDENTIAL</span></div>${body}
    <p class="note">Generated by Valuables Vault ${APP_VERSION}. Values as recorded by the owner; market value and insurance / replacement value differ. This report is not a valuation or legal document.</p>
    <div class="rbrand">${BRAND_LOGO ? `<img src="${BRAND_LOGO}" alt="Team Nepal Solutions">` : ''}<div>Powered by<br><b>© Ing.-Büro Sachit Shrestha</b><br><a href="mailto:support@medtec24.com">support@medtec24.com</a></div></div></main></body></html>`;
}
function openReport(title, body) {
  audit('Report created', 'report', title, '', ''); saveSoon();
  if (NATIVE) return showReportInApp(title, reportHTML(title, body, false));
  const w = REPWIN && !REPWIN.closed ? REPWIN : window.open('', '_blank'); REPWIN = null; if (!w) return toast('Allow pop-ups to open the report.');
  w.document.open(); w.document.write(reportHTML(title, body, true)); w.document.close();
}
function itemKV(it, conf) {
  const v = itemVals(it); const d = it.details || {}; const gs = SCHEMA.categories[it.cat]?.groups || [];
  const dl = gs.flatMap(g => SCHEMA.groups[g].fields.filter(f => d[f.k] !== undefined && d[f.k] !== '').map(f => [f.label, f.sensitive && !conf ? mask(d[f.k]) : f.type === 'date' ? fmtDate(d[f.k]) : d[f.k]]));
  const rows = [['Category', catName(it.cat)], ['Description', it.description], ['Brand / model', [it.brand, it.model].filter(Boolean).join(' ')], ['Serial number', it.serial], ['Owner', `${personName(it.ownerId)}${it.ownershipPct !== '' && it.ownershipPct != null ? ` (${it.ownershipPct} %)` : ''}`],
  ['Acquisition', [it.acquisition, fmtDate(it.purchaseDate || it.acquiredDate)].filter(x => x && x !== '—').join(', ')], ['Purchased from', [it.seller, it.purchaseLocation, it.purchaseCountry].filter(Boolean).join(', ')], ['Invoice', it.invoiceNo],
  ['Purchase price', v.purchase != null ? money(v.purchase, it.currency) : ''], ['Current value', v.current ? `${money(v.current.value, v.current.currency)} (${v.current.type}, ${fmtDate(v.current.date)})` : ''],
  ['Insurance value', v.insurance ? `${money(v.insurance.value, v.insurance.currency)} (${fmtDate(v.insurance.date)})` : ''], ['Storage location', locName(it.locationId)], ...dl];
  return `<div class="kv">${rows.filter(r => r[1] && r[1] !== '—').map(r => `<b>${esc(r[0])}</b><span>${esc(r[1])}</span>`).join('')}</div>`;
}
async function buildReport(kind, items, f) {
  if (!NATIVE) { // open synchronously inside the click so pop-up blockers allow it
    REPWIN = window.open('', '_blank');
    if (REPWIN) REPWIN.document.write('<p style="font:14px sans-serif;padding:20px">Preparing report…</p>');
  }
  const conf = !!f.conf, base = S.settings.baseCurrency;
  if (kind === 'inventory' || kind === 'selected') {
    let body = summaryTable(items);
    for (const it of items) { const ph = itemFiles(it, 'photo')[0]; const img = f.photos && ph ? await photoData(ph, 600) : ''; body += `<div class="item">${img ? `<img src="${img}" alt="">` : '<div></div>'}<div><h3 style="margin-top:0">${esc(it.name)} <span style="font:9pt monospace;color:#666">${esc(it.id)}</span></h3>${itemKV(it, conf)}<div style="font-size:8.5pt;color:#666;margin-top:2mm">Documents: ${itemFiles(it, 'doc').map(d => esc(d.docType)).join(', ') || 'none'} · Photos: ${itemFiles(it, 'photo').length} · Documentation ${itemScore(it).score}%</div></div></div>`; }
    if (f.allPhotos) for (const it of items) { const ps = itemFiles(it, 'photo'); if (!ps.length) continue; body += `<h2>Photographs — ${esc(it.id)}</h2><div class="ph">`; for (const p of ps) { const img = await photoData(p, 800); body += `<figure>${img ? `<img src="${img}" alt="">` : ''}<figcaption><b>${esc(p.view)}</b>${p.caption ? ' · ' + esc(p.caption) : ''}<br>Taken ${fmtDate(p.photoDate)} · SHA-256 ${p.sha256.slice(0, 16)}…</figcaption></figure>`; } body += '</div>';
      const docs = itemFiles(it, 'doc'); if (docs.length) body += `<h2>Supporting documents — ${esc(it.id)}</h2><table><thead><tr><th>Type</th><th>File</th><th>Reference</th><th>Date</th><th>SHA-256</th></tr></thead><tbody>${docs.map(d => `<tr><td>${esc(d.docType)}</td><td>${esc(d.name)}</td><td>${esc(d.ref || '')}</td><td>${fmtDate(d.docDate || d.uploadDate)}</td><td style="font-family:monospace;font-size:8pt">${d.sha256}</td></tr>`).join('')}</tbody></table>`;
      const vs = itemValuations(it); body += `<h2>Valuation history — ${esc(it.id)}</h2><table><thead><tr><th>Date</th><th>Type</th><th class="n">Value</th><th>Source</th><th>Valuer</th></tr></thead><tbody>${vs.map(v => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.type)}</td><td class="n">${money(v.value, v.currency)}</td><td>${esc(v.source || '')}</td><td>${esc(v.valuer || '')}</td></tr>`).join('')}</tbody></table>`;
      const vers = S.verifications.filter(v => (v.itemIds || []).includes(it.id)); if (vers.length) body += `<h2>Verification</h2><ul>${vers.map(v => `<li>${fmtDate(v.date)} — ${esc(v.type)} by ${esc(v.witness)}${v.place ? ', ' + esc(v.place) : ''}</li>`).join('')}</ul>`; }
    return openReport(f.allPhotos ? 'Item Evidence Sheet' : 'Personal Inventory Report', body);
  }
  if (kind === 'photo') {
    let body = ''; for (const it of items) { const ps = itemFiles(it, 'photo'); if (!ps.length) continue; body += `<h2>${esc(it.id)} — ${esc(it.name)}</h2><div class="ph">`; for (const p of ps) { const img = await photoData(p, 800); body += `<figure>${img ? `<img src="${img}" alt="">` : '<div style="height:45mm;border:1px solid #ddd;display:flex;align-items:center;justify-content:center">HEIC — see original</div>'}<figcaption><b>${esc(p.view)}</b>${p.caption ? ' · ' + esc(p.caption) : ''}<br>Taken ${fmtDate(p.photoDate)} (${esc(p.photoDateSource || '')}) · uploaded ${fmtDate(p.uploadDate)}${p.photographer ? ' · by ' + esc(p.photographer) : ''}<br><span style="font-family:monospace">${esc(p.name)} · SHA-256 ${p.sha256.slice(0, 16)}…</span></figcaption></figure>`; } body += '</div>'; }
    return openReport('Photo Inventory Report', body || '<p>No photographs.</p>');
  }
  if (kind === 'insurance' || kind === 'insurance-one') {
    const pols = kind === 'insurance-one' ? [policy(f.policyId)] : S.policies; let body = '';
    for (const p of pols) { const a = policyAnalysis(p); body += `<h2>${esc(p.insurer)} — ${esc(p.type || '')}</h2><div class="kv"><b>Policy no.</b><span>${esc(conf ? p.number : mask(p.number))}</span><b>Holder</b><span>${esc(personName(p.holderId))}</span><b>Sum insured</b><span>${money(p.coverage, p.currency)}</span><b>Period</b><span>${fmtDate(p.start)} – renewal ${fmtDate(p.renewal)}</span><b>Deductible</b><span>${p.deductible ? money(p.deductible, p.currency) : '—'}</span><b>Covered items value</b><span>${moneyBase(a.total)} (${a.items.length} items)</span><b>Recommended cover</b><span>at least ${moneyBase(a.total)} for the listed valuables (plus other household contents for a household policy)</span><b>Status</b><span class="${statusClass(a.status)}">${esc(a.status)}${a.gap > 0 ? ` — gap ${moneyBase(a.gap)}` : ''}</span></div>
      <h3>Findings</h3><ul>${a.checks.map(c => `<li class="${c.sev === 'ok' ? '' : c.sev}">${esc(c.text)}</li>`).join('') || '<li>None</li>'}</ul>${p.docRequirements ? `<h3>Documentation requirements</h3><p>${esc(p.docRequirements)}</p>` : ''}
      <table><thead><tr><th>ID</th><th>Item</th><th>Location</th><th class="n">Insurance (${base})</th><th>Invoice</th><th>Certificate / appraisal</th><th>Photos</th><th>Valuation</th></tr></thead><tbody>${a.items.map(it => `<tr><td>${esc(it.id)}</td><td>${esc(it.name)}</td><td>${esc(locName(it.locationId))}</td><td class="n">${moneyBase(exposure(it))}</td><td>${hasDoc(it, PURCHASE_DOCS) ? '✓' : '<span class="bad">missing</span>'}</td><td>${hasDoc(it, CERT_DOCS) ? '✓' : SCHEMA.categories[it.cat]?.certExpected ? '<span class="bad">missing</span>' : 'n/a'}</td><td>${itemFiles(it, 'photo').length || '<span class="bad">0</span>'}</td><td>${valuationOutdated(it) ? '<span class="warn">outdated</span>' : fmtDate(itemVals(it).lastValDate)}</td></tr>`).join('')}</tbody></table>`; }
    const unins = activeItems().filter(i => !itemPolicies(i).length);
    if (kind === 'insurance' && unins.length) body += `<h2>Items not covered by any policy</h2>${summaryTable(unins)}`;
    return openReport('Insurance Report', body || '<p>No policies recorded.</p>');
  }
  if (kind === 'locker') {
    const lockers = f.locId ? [loc(f.locId)] : S.locations.filter(isLocker); let body = '';
    for (const l of lockers) { const L = l.locker || {}; const c = activeItems().filter(i => i.locationId === l.id);
      body += `<h2>${esc(l.name)}</h2><div class="kv"><b>Bank / branch</b><span>${esc(L.bank || '')} · ${esc(L.branch || '')}</span><b>Locker no.</b><span>${esc(conf ? L.number : mask(L.number))}</span><b>Locker type</b><span>${esc(L.lockerType || '')}</span><b>Agreement</b><span>${esc(conf ? L.agreementRef : mask(L.agreementRef))}</span><b>Holders</b><span>${esc((L.holderIds || []).map(personName).join(', '))}</span><b>Access authority</b><span>${esc(L.access || '')}</span><b>Bank-provided cover</b><span>${L.bankInsured ? money(L.bankInsured, L.bankInsuredCurrency) : '—'}</span><b>Last inspection</b><span>${fmtDate(L.lastInspection)}</span></div>
      <table><thead><tr><th>#</th><th>Inventory ID</th><th>Item</th><th>Description / identifiers</th><th class="n">Insurance / current (${base})</th><th>Present ✓</th></tr></thead><tbody>${c.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.id)}</td><td>${esc(it.name)}</td><td>${esc([it.description, it.serial && 'S/N ' + it.serial, it.details?.hallmark && 'Hallmark ' + it.details.hallmark, it.details?.grossWeight && it.details.grossWeight + ' g', it.details?.certNumber && 'Cert ' + it.details.certNumber].filter(Boolean).join(' · '))}</td><td class="n">${moneyBase(exposure(it))}</td><td style="width:18mm"></td></tr>`).join('')}<tr class="tot"><td colspan="4">Total (${c.length} items)</td><td class="n">${moneyBase(c.reduce((a, i) => a + exposure(i), 0))}</td><td></td></tr></tbody></table>
      <p style="font-size:9.5pt">The undersigned confirm that the items listed above were present in the locker on __________________ (date) at __________ (time).</p>
      <div class="sig"><div>Locker holder — name, signature</div><div>Witness — name, signature</div></div><div style="page-break-after:always"></div>`; }
    return openReport('Bank Locker Inventory', body || '<p>No bank locker recorded.</p>');
  }
  if (kind === 'estate') {
    let body = ''; const owners = [...new Set(items.map(i => i.ownerId))];
    for (const o of owners) { const its = items.filter(i => i.ownerId === o); body += `<h2>${esc(personName(o) || 'Owner not recorded')}</h2><table><thead><tr><th>ID</th><th>Asset</th><th>Ownership</th><th>Co-owners</th><th>Beneficiaries</th><th>Location</th><th class="n">Current (${base})</th><th>Supporting documents</th></tr></thead><tbody>${its.map(it => `<tr><td>${esc(it.id)}</td><td>${esc(it.name)}</td><td>${esc([it.ownershipType, it.ownershipPct !== '' && it.ownershipPct != null ? it.ownershipPct + ' %' : '', it.acquisition].filter(Boolean).join(', '))}</td><td>${esc((it.coOwnerIds || []).map(personName).join(', '))}</td><td>${esc((it.beneficiaryIds || []).map(personName).join(', ') || '—')}</td><td>${esc(locName(it.locationId))}</td><td class="n">${moneyBase(itemVals(it).currentBase)}</td><td>${itemFiles(it, 'doc').map(d => esc(d.docType)).join(', ') || '—'}</td></tr>`).join('')}<tr class="tot"><td colspan="6">Total</td><td class="n">${moneyBase(its.reduce((a, i) => a + (itemVals(i).currentBase || 0), 0))}</td><td></td></tr></tbody></table>`; }
    const bens = {}; for (const it of items) for (const b of it.beneficiaryIds || []) (bens[b] = bens[b] || []).push(it);
    body += `<h2>By beneficiary</h2><table><thead><tr><th>Beneficiary</th><th>Assets</th><th class="n">Current value (${base}, undivided)</th></tr></thead><tbody>${Object.entries(bens).map(([b, its]) => `<tr><td>${esc(personName(b))}</td><td>${its.map(i => esc(i.id)).join(', ')}</td><td class="n">${moneyBase(its.reduce((a, i) => a + (itemVals(i).currentBase || 0), 0))}</td></tr>`).join('') || '<tr><td colspan="3">No beneficiaries recorded</td></tr>'}</tbody></table>
      <p class="note">Beneficiary entries record the owner's intentions for planning purposes only. They do not replace a will or other legally valid disposition — in Germany a handwritten or notarised will governs; in Nepal the Muluki Civil Code inheritance rules apply.</p>`;
    return openReport('Estate & Inheritance Report', body);
  }
  if (kind === 'verification' || kind === 'verification-one') {
    const list = kind === 'verification-one' ? [byId(S.verifications, f.verId)] : S.verifications; let body = '';
    for (const v of list) body += `<h2>${esc(v.type)} — ${fmtDate(v.date)}</h2><div class="kv"><b>Witness</b><span>${esc(v.witness)}${v.relationship ? ' (' + esc(v.relationship) + ')' : ''}</span><b>Place</b><span>${esc([v.place, locName(v.locationId)].filter(Boolean).join(', '))}</span><b>Reference</b><span>${esc(conf ? v.idRef : mask(v.idRef))}</span><b>Comments</b><span>${esc(v.comments)}</span></div>
      <table><thead><tr><th>Inventory ID</th><th>Item</th><th>Identifiers</th></tr></thead><tbody>${(v.itemIds || []).map(id => { const it = item(id); return it ? `<tr><td>${esc(id)}</td><td>${esc(it.name)}</td><td>${esc([it.serial, it.details?.hallmark, it.details?.certNumber].filter(Boolean).join(' · '))}</td></tr>` : ''; }).join('')}</tbody></table>
      <div class="sig"><div>${v.signature ? `<img src="${v.signature}" style="height:22mm;display:block">` : ''}Witness: ${esc(v.witness)} — signature</div><div>Owner: ${esc(S.settings.userName)} — signature</div></div>`;
    return openReport('Inventory Verification Report', body || '<p>No verifications recorded.</p>');
  }
  if (kind === 'missing') {
    return openReport('Missing Information Report', `<table><thead><tr><th>ID</th><th>Item</th><th class="n">Score</th><th>To complete</th></tr></thead><tbody>${items.map(it => ({ it, s: itemScore(it) })).sort((a, b) => a.s.score - b.s.score).map(({ it, s }) => `<tr><td>${esc(it.id)}</td><td>${esc(it.name)}</td><td class="n">${s.score}%</td><td>${s.missing.map(esc).join('; ') || '<span class="ok">complete</span>'}</td></tr>`).join('')}</tbody></table>`);
  }
  if (kind === 'qr') return openReport('QR Labels', `<p style="font-size:9pt">Labels contain only the inventory reference. Cut out and attach to boxes, pouches or certificate folders.</p><div class="qrs">${items.map(it => `<div>${qrSVG(it.id)}<br>${esc(it.id)}</div>`).join('')}</div>`);
}
function summaryTable(items) {
  const b = S.settings.baseCurrency; const t = f => items.reduce((a, i) => a + (f(itemVals(i)) || 0), 0);
  return `<table><thead><tr><th>ID</th><th>Item</th><th>Owner</th><th>Location</th><th class="n">Purchase (${b})</th><th class="n">Current (${b})</th><th class="n">Insurance (${b})</th></tr></thead><tbody>${items.map(it => { const v = itemVals(it); return `<tr><td>${esc(it.id)}</td><td>${esc(it.name)}</td><td>${esc(personName(it.ownerId))}</td><td>${esc(locName(it.locationId))}</td><td class="n">${moneyBase(v.purchaseBase)}</td><td class="n">${moneyBase(v.currentBase)}</td><td class="n">${moneyBase(v.insuranceBase)}</td></tr>`; }).join('')}<tr class="tot"><td colspan="4">Total · ${items.length} items</td><td class="n">${moneyBase(t(v => v.purchaseBase))}</td><td class="n">${moneyBase(t(v => v.currentBase))}</td><td class="n">${moneyBase(t(v => v.insuranceBase))}</td></tr></tbody></table>`;
}

/* ---------- backup & restore ---------- */
VIEWS.backup = () => {
  const last = S.backups[S.backups.length - 1];
  return `<h1>Backup & recovery</h1>
  <div class="grid g2"><div class="card"><h3>Create encrypted backup</h3><p class="small muted">One file containing all records, photos, documents and the audit log, encrypted with AES-256-GCM. After writing, the backup is decrypted again and checked (verification). Save copies to an external drive, NAS or your own cloud storage — the file is unreadable without the password.</p>
    <form id="bkf"><label class="row small"><input type="radio" name="pwmode" value="vault" checked> Use the vault password</label><label class="row small"><input type="radio" name="pwmode" value="own"> Use a separate backup password (e.g. for an heir or executor)</label>
    <div class="fields" id="bkpw" style="display:none;margin-top:8px"><label class="f">Backup password<input type="password" name="pw1" autocomplete="new-password"></label><label class="f">Repeat<input type="password" name="pw2" autocomplete="new-password"></label></div>
    <div class="err" id="bkerr"></div><button class="btn pri" type="submit">Create & verify backup</button></form>
    <p class="small muted" style="margin-top:10px">${last ? `Last backup ${fmtTs(last.ts)} — ${last.verified ? 'verified ✓' : 'NOT verified'}` : 'No backup yet.'} Reminder after ${S.settings.backupReminderDays} days. (Browsers cannot write files silently, so automatic backups need the desktop/mobile app — see specification.)</p></div>
  <div class="card"><h3>Restore</h3><p class="small muted">Restoring replaces everything in this vault with the backup contents. The current vault password stays the same; data is re-encrypted with it.</p><button class="btn" data-act="restore">Restore from backup file…</button>
    <h3 style="margin-top:16px">Verify an existing backup file</h3><p class="small muted">Checks that a file decrypts and is complete, without changing anything.</p><button class="btn" data-act="verify-backup">Verify backup file…</button></div></div>
  <h3 style="margin-top:16px">Backup history</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th>File</th><th class="num">Items</th><th class="num">Files</th><th class="num">Size</th><th>Password</th><th>Verified</th><th>SHA-256</th></tr></thead><tbody>
  ${S.backups.slice().reverse().map(b => `<tr><td>${fmtTs(b.ts)}</td><td class="small">${esc(b.file)}</td><td class="num">${b.items}</td><td class="num">${b.files}</td><td class="num">${fmtSize(b.size)}</td><td>${b.pwmode === 'own' ? 'separate' : 'vault'}</td><td>${b.verified ? '<span class="pill ok">✓ verified</span>' : '<span class="pill bad">failed</span>'}</td><td class="mono small">${b.sha256.slice(0, 16)}…</td></tr>`).join('') || '<tr><td colspan="8" class="empty">None yet</td></tr>'}</tbody></table></div>`;
};
AFTER.backup = () => {
  $$('[name=pwmode]').forEach(r => r.onchange = () => $('#bkpw').style.display = $('[name=pwmode]:checked').value === 'own' ? '' : 'none');
  $('#bkf').onsubmit = async e => {
    e.preventDefault(); const o = formObj(e.target); let pw;
    if (o.pwmode === 'own') { if (o.pw1.length < 12) return $('#bkerr').textContent = 'Backup password: at least 12 characters.'; if (o.pw1 !== o.pw2) return $('#bkerr').textContent = 'Passwords do not match.'; pw = o.pw1; }
    else { pw = await askPassword('Backup with vault password'); if (!pw) return; }
    $('#bkerr').textContent = 'Encrypting…'; try { await createBackup(pw, o.pwmode); } catch (err) { $('#bkerr').textContent = 'Backup failed: ' + err.message; }
  };
};
async function createBackup(pw, pwmode) {
  await saveNow();
  const blobs = {}; for (const f of S.files) { const b = await getBlob(f.id); if (b) blobs[f.id] = b64(b); }
  const payload = enc.encode(JSON.stringify({ db: S, blobs }));
  const salt = crypto.getRandomValues(new Uint8Array(16)); const key = await deriveKEK(pw, salt, PBKDF2_ITER);
  const r = await aesEnc(key, payload);
  const fileObj = { format: 'valuables-vault-backup', v: 1, app: APP_VERSION, created: nowISO(), kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: b64(salt), iv: b64(r.iv), ct: b64(r.ct) };
  const text = JSON.stringify(fileObj); const bytes = enc.encode(text);
  // verification: decrypt what we are about to write and compare
  const check = await readBackup(text, pw); const verified = check.db.items.length === S.items.length && Object.keys(check.blobs).length === Object.keys(blobs).length;
  const name = `valuables-backup-${stamp()}.vaultbak`;
  S.backups.push({ ts: nowISO(), file: name, items: S.items.length, files: Object.keys(blobs).length, size: bytes.length, sha256: await sha256hex(bytes), verified, pwmode });
  audit('Backup performed', 'backup', name, '', verified ? 'verified' : 'verification FAILED');
  const saved = await download(name, new Blob([bytes], { type: 'application/octet-stream' }));
  if (saved === false) { S.backups.pop(); S.audit.pop(); await saveNow(); toast('Backup cancelled — nothing was saved.'); return; }
  await saveNow();
  toast(verified ? 'Backup created and verified. Store it somewhere safe.' : 'Backup created but verification failed!'); rerender();
}
async function readBackup(text, pw) {
  const o = JSON.parse(text); if (o.format !== 'valuables-vault-backup') throw new Error('Not a Valuables Vault backup file');
  const key = await deriveKEK(pw, unb64(o.salt), o.iter);
  let plain; try { plain = await aesDec(key, unb64(o.iv), unb64(o.ct)); } catch { throw new Error('Wrong password or the file is damaged'); }
  const p = JSON.parse(dec.decode(plain)); if (!p.db || !Array.isArray(p.db.items)) throw new Error('Backup content incomplete');
  return p;
}
function pickFile(accept) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0]); i.click(); }); }
async function restoreFlow(fromLock = false) {
  const file = await pickFile('.vaultbak,.json,application/octet-stream'); if (!file) return;
  const d = modal('Restore backup', `<p>File: <b>${esc(file.name)}</b> (${fmtSize(file.size)})</p><label class="f">Backup password<input type="password" id="rs-pw"></label>
    ${fromLock ? '<label class="f">New vault password for this device (min. 12 characters)<input type="password" id="rs-new"></label>' : ''}<div class="err" id="rs-err"></div><div id="rs-info"></div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn pri" data-ok>Decrypt & check</button>`, { width: '520px' });
  let payload = null;
  $('[data-ok]', d).onclick = async () => {
    const err = $('#rs-err', d);
    if (!payload) {
      err.textContent = 'Decrypting…';
      try { payload = await readBackup(await file.text(), $('#rs-pw', d).value); } catch (e) { err.textContent = e.message; return; }
      err.textContent = ''; const db = payload.db;
      $('#rs-info', d).innerHTML = `<div class="callout">Backup OK — created ${fmtTs(db.updated)} by ${esc(db.settings?.userName)}: ${db.items.length} items, ${Object.keys(payload.blobs).length} files, ${db.valuations.length} valuations, ${db.audit.length} audit entries.<br><b>Restoring replaces all current data on this device.</b></div>`;
      $('[data-ok]', d).textContent = 'Replace current data'; $('[data-ok]', d).classList.add('danger'); return;
    }
    if (fromLock) { const np = $('#rs-new', d).value; if (np.length < 12) { err.textContent = 'Choose a new vault password (min. 12 characters).'; return; } await createVault(np); }
    else if (!(await confirmBox('Replace all data?', 'Everything currently in the vault will be replaced by the backup. Continue?', 'Replace', true))) return;
    err.textContent = 'Restoring…';
    for (const k of await blobKeys()) await delBlob(k);
    for (const [id, b] of Object.entries(payload.blobs)) await putBlob(id, unb64(b));
    S = payload.db; migrate(S); audit('Backup restored', 'backup', file.name, '', `${S.items.length} items`); await saveNow();
    d.close(); toast('Backup restored'); startShell();
  };
}
async function verifyBackupFile() {
  const file = await pickFile('.vaultbak,.json'); if (!file) return;
  const pw = await new Promise(res => { let v = null; const d = modal('Verify backup', `<label class="f">Backup password<input type="password" id="vb-pw"></label>`, `<button class="btn" data-close>Cancel</button><button class="btn pri" data-ok>Verify</button>`, { width: '440px', onClose: () => res(v) }); $('[data-ok]', d).onclick = () => { v = $('#vb-pw', d).value; d.close(); }; });
  if (pw == null) return;
  try { const p = await readBackup(await file.text(), pw); const missing = p.db.files.filter(f => !p.blobs[f.id]).length; modal('Backup verified', `<p class="${missing ? 'status-o' : 'status-a'}">${missing ? `Decrypts, but ${missing} file(s) are missing from the backup.` : 'The backup decrypts correctly and is complete.'}</p><p>${p.db.items.length} items · ${Object.keys(p.blobs).length} files · last change ${fmtTs(p.db.updated)}</p>`, '<button class="btn pri" data-close>OK</button>', { width: '460px' }); }
  catch (e) { modal('Verification failed', `<p class="status-u">${esc(e.message)}</p>`, '<button class="btn" data-close>OK</button>', { width: '440px' }); }
}

/* ---------- QR scan ---------- */
async function scanQR() {
  if (Platform.hasCameraScan()) { // phones and tablets: native camera scanner
    const ref = await Platform.scanQR();
    if (ref) { const id = String(ref).trim().toUpperCase(); if (item(id)) return go('item', { id }); toast(`No record "${id}" in this vault.`); }
    return;
  }
  const d = modal('Open record by QR label', `<video id="qrv" playsinline style="width:100%;max-height:50vh;background:#000;border-radius:8px;display:none"></video><p class="small muted" id="qrmsg"></p>
    <form id="qrman" class="row"><input name="ref" placeholder="or type the reference, e.g. JWL-2026-00001" style="flex:1"><button class="btn pri">Open</button></form>`, '', { width: '560px', onClose: () => stream?.getTracks().forEach(t => t.stop()) });
  let stream = null;
  const openRef = ref => { ref = String(ref).trim().toUpperCase(); if (item(ref)) { d.close(); go('item', { id: ref }); } else $('#qrmsg', d).textContent = `No record "${ref}" in this vault.`; };
  $('#qrman', d).onsubmit = e => { e.preventDefault(); openRef(e.target.ref.value); };
  if (!('BarcodeDetector' in window)) { $('#qrmsg', d).textContent = 'This browser has no built-in QR scanner (supported in Chrome on Android/macOS). Type the reference instead — the native apps scan on every platform.'; return; }
  try {
    const det = new BarcodeDetector({ formats: ['qr_code'] }); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('#qrv', d); v.srcObject = stream; v.style.display = 'block'; await v.play(); $('#qrmsg', d).textContent = 'Point the camera at a label…';
    const loop = async () => { if (!d.open) return; try { const r = await det.detect(v); if (r[0]) return openRef(r[0].rawValue); } catch { } requestAnimationFrame(loop); }; loop();
  } catch (e) { $('#qrmsg', d).textContent = 'Camera not available: ' + e.message; }
}

/* ---------- sample data ---------- */
function samplePhoto(label, hue, shape) {
  const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 800, 600); g.addColorStop(0, `hsl(${hue},25%,92%)`); g.addColorStop(1, `hsl(${hue},20%,78%)`); x.fillStyle = g; x.fillRect(0, 0, 800, 600);
  x.strokeStyle = `hsl(${hue},60%,38%)`; x.fillStyle = `hsl(${hue},65%,55%)`; x.lineWidth = 10;
  if (shape === 'necklace') { x.beginPath(); x.ellipse(400, 250, 230, 190, 0, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); for (let i = 0; i < 26; i++) { const a = 0.15 * Math.PI + i * (0.7 * Math.PI / 25); x.beginPath(); x.arc(400 + 230 * Math.cos(a), 250 + 190 * Math.sin(a), 9, 0, 7); x.fill(); } x.beginPath(); x.moveTo(400, 440); x.lineTo(430, 490); x.lineTo(400, 540); x.lineTo(370, 490); x.closePath(); x.fill(); }
  else if (shape === 'ring') { x.beginPath(); x.arc(400, 340, 130, 0, 7); x.stroke(); x.fillStyle = '#e8f4ff'; x.beginPath(); x.moveTo(400, 150); x.lineTo(450, 200); x.lineTo(400, 240); x.lineTo(350, 200); x.closePath(); x.fill(); x.stroke(); }
  else if (shape === 'coin') { for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(260 + i * 140, 300, 110, 0, 7); x.fill(); x.stroke(); } }
  else if (shape === 'art') { x.fillStyle = '#5b3d1e'; x.fillRect(150, 90, 500, 400); x.fillStyle = `hsl(${hue},45%,62%)`; x.fillRect(180, 120, 440, 340); x.fillStyle = `hsl(${hue + 150},40%,40%)`; x.beginPath(); x.moveTo(180, 460); x.lineTo(340, 260); x.lineTo(470, 400); x.lineTo(540, 330); x.lineTo(620, 460); x.fill(); }
  else if (shape === 'watch') { x.fillRect(360, 60, 80, 480); x.fillStyle = '#fafafa'; x.beginPath(); x.arc(400, 300, 120, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(400, 300); x.lineTo(400, 210); x.moveTo(400, 300); x.lineTo(460, 320); x.stroke(); }
  else { x.font = 'bold 60px monospace'; x.fillStyle = `hsl(${hue},60%,30%)`; x.fillText(shape, 120, 320); }
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 548, 800, 52); x.fillStyle = '#fff'; x.font = '26px sans-serif'; x.fillText('SAMPLE · ' + label, 18, 584);
  return new Promise(r => c.toBlob(b => r(b), 'image/jpeg', .85));
}
async function sampleAttach(it, kind, name, blob, meta) {
  const buf = await blob.arrayBuffer(); const id = uid();
  const m = { id, itemId: it.id, kind, name, mime: blob.type, size: buf.byteLength, uploadDate: todayISO(), uploadTs: nowISO(), sha256: await sha256hex(buf), sample: true, ...meta };
  if (kind === 'photo' || blob.type.startsWith('image/')) m.thumb = await makeThumb(blob, 360);
  await putBlob(id, buf); S.files.push(m); return m;
}
async function loadSampleData() {
  if (S.items.some(i => i.id === 'JWL-2026-00001')) return toast('Sample data already loaded.');
  const P = (name, relationship, roles) => { const p = { id: uid(), name, relationship, roles, sample: true }; S.people.push(p); return p; };
  const me = S.people.find(p => p.name === 'Sachit Shrestha') || P('Sachit Shrestha', 'self', ['Owner', 'Locker holder']);
  const sp = P('Family member (sample)', 'spouse', ['Co-owner', 'Beneficiary', 'Locker holder']); const ch = P('Child (sample)', 'daughter', ['Beneficiary']); const wit = P('Witness (sample)', 'friend', ['Witness']);
  const L = (o) => { const l = { id: uid(), sample: true, ...o }; S.locations.push(l); return l; };
  const home = L({ name: 'Home – living room', type: 'Home', address: 'Bergisch Gladbach' });
  const safe = L({ name: 'Bedroom safe', type: 'Home safe', safe: { certified: true, grade: 'EN 1143-1 Grade I', weight: '210 kg, anchored' } });
  const locker = L({ name: 'Bank locker – Sparkasse (sample)', type: 'Bank locker', locker: { bank: 'Sample Sparkasse', branch: 'Main branch', number: '00374821', lockerType: 'Size B', agreementRef: 'SF-2019-559134', holderIds: [me.id, sp.id], access: 'Joint – either holder', bankInsured: 10000, bankInsuredCurrency: 'EUR', insuranceNotes: 'Bank group cover up to €10,000 per locker; top-up via partner insurer possible', lastInspection: '2026-05-20', nextReview: '2027-05-20' } });
  const lockerNp = L({ name: 'Bank locker – Kathmandu (sample)', type: 'Bank locker', locker: { bank: 'Sample Bank Nepal', branch: 'New Road', number: '000917', lockerType: 'Type B', agreementRef: 'KTM-LK-2018-0917', holderIds: [me.id], access: 'Holder + nominee', bankInsuredCurrency: 'NPR', insuranceNotes: 'Agreement excludes bank liability except for proven negligence', lastInspection: '2025-02-10', nextReview: '2026-02-10' } });
  const pol = { id: uid(), sample: true, insurer: 'Sample Hausrat AG', number: 'HR-55-0019134', holderId: me.id, type: 'Household contents (Hausrat)', coverage: 95000, currency: 'EUR', start: '2026-01-01', renewal: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10), deductible: 250, valuablesPct: 20, outsideSafeLimit: 20000, theft: true, fire: true, water: true, natural: false, worldwide: false, lockerCoverage: true, lockerLimit: 25000, docRequirements: 'Invoices or appraisals for valuables over €3,000; photographs; list of bank-locker contents kept outside the locker.' };
  S.policies.push(pol);
  S.settings.fx.NPR = S.settings.fx.NPR || 0.0067; S.settings.fx.USD = S.settings.fx.USD || 0.86; S.settings.fxDate = S.settings.fxDate || todayISO();
  const mk = (o) => { const it = { coOwnerIds: [], beneficiaryIds: [], ownershipType: 'Sole', ownershipPct: 100, acquisition: 'Purchased', currency: 'EUR', created: nowISO(), updated: nowISO(), sample: true, ...o }; S.items.push(it); audit('Created', 'item', it.id, '', it.name + ' (sample)'); return it; };
  // 1 — the example record from the brief
  const n = mk({ id: 'JWL-2026-00001', name: 'Gold Necklace', cat: 'JWL', subcat: 'Necklace', description: '18K yellow gold curb-link necklace with pendant, 50 cm, box clasp', brand: '', manufacturer: 'Sample Goldschmiede', purchaseDate: '2021-06-15', acquiredDate: '2021-06-15', purchasePrice: 4500, purchaseLocation: 'Cologne', purchaseCountry: 'Germany', seller: 'Sample Juwelier GmbH', invoiceNo: 'INV-2021-12345', ownerId: me.id, beneficiaryIds: [ch.id], locationId: locker.id, policyId: pol.id, details: { metalType: 'Gold', goldColour: 'Yellow', purity: 750, karat: '750 / 18K', grossWeight: 52.4, netMetalWeight: 51.8, hallmark: '750, maker\'s mark', metalPricePurchase: 49.5, metalPriceCurrent: 98, metalPriceDate: '2026-05-20', length: 500 } });
  addValuation({ itemId: n.id, type: 'Appraised', value: 5900, currency: 'EUR', date: '2026-05-20', source: 'Professional valuer', valuer: 'Sample Gutachter (sample)' });
  addValuation({ itemId: n.id, type: 'Insurance', value: 7000, currency: 'EUR', date: '2026-05-20', source: 'Insurance appraisal', valuer: 'Sample Gutachter (sample)' });
  for (const [view, cap] of [['Front', 'full necklace laid flat'], ['Rear', 'reverse side'], ['Detail', 'pendant close-up'], ['Hallmark', '750 hallmark on clasp'], ['Storage location', 'in locker pouch']])
    await sampleAttach(n, 'photo', `necklace-${view.toLowerCase().replace(/ /g, '-')}.jpg`, await samplePhoto(`${n.id} ${view}`, 42, 'necklace'), { view, caption: cap, photoDate: '2026-05-20', photoDateSource: 'sample', photographer: 'Sachit Shrestha' });
  const SF = window.__SAMPLE_FILES || {};
  const pdf = k => new Blob([unb64(SF[k])], { type: 'application/pdf' });
  if (SF.invoice) await sampleAttach(n, 'doc', 'INV-2021-12345.pdf', pdf('invoice'), { docType: 'Purchase invoice', ref: 'INV-2021-12345', docDate: '2021-06-15' });
  if (SF.cert) await sampleAttach(n, 'doc', 'gold-assay-certificate.pdf', pdf('cert'), { docType: 'Certificate', ref: 'ASY-2021-0815', docDate: '2021-06-15' });
  if (SF.appraisal) await sampleAttach(n, 'doc', 'appraisal-2026-05-20.pdf', pdf('appraisal'), { docType: 'Appraisal', ref: 'GA-2026-118', docDate: '2026-05-20' });
  // 2 — diamond ring, well documented, at home safe
  const r = mk({ id: 'DIA-2026-00001', name: 'Diamond solitaire ring', cat: 'DIA', description: 'Platinum solitaire ring, round brilliant 1.02 ct', purchaseDate: '2019-03-08', purchasePrice: 8200, seller: 'Sample Diamonds Antwerp', purchaseCountry: 'Belgium', invoiceNo: 'SD-19-0442', ownerId: sp.id, ownershipType: 'Sole', beneficiaryIds: [ch.id], locationId: safe.id, policyId: pol.id, details: { gemType: 'Diamond', gemCount: 1, carat: 1.02, shape: 'Round', cut: 'Excellent', colour: 'G', clarity: 'VS1', fluorescence: 'None', certAuthority: 'GIA', certNumber: '2195730461', laserInscription: 'GIA 2195730461' } });
  addValuation({ itemId: r.id, type: 'Market', value: 7400, currency: 'EUR', date: '2025-11-02', source: 'Dealer quote' });
  addValuation({ itemId: r.id, type: 'Replacement', value: 11500, currency: 'EUR', date: '2025-11-02', source: 'Insurance appraisal' });
  await sampleAttach(r, 'photo', 'ring-front.jpg', await samplePhoto(`${r.id} Front`, 210, 'ring'), { view: 'Front', caption: '', photoDate: '2025-11-02', photoDateSource: 'sample' });
  await sampleAttach(r, 'photo', 'ring-cert.jpg', await samplePhoto(`${r.id} Certificate`, 210, 'GIA 2195730461'), { view: 'Certificate', caption: 'GIA report', photoDate: '2025-11-02', photoDateSource: 'sample' });
  if (SF.invoice) await sampleAttach(r, 'doc', 'SD-19-0442.pdf', pdf('invoice'), { docType: 'Purchase invoice', ref: 'SD-19-0442', docDate: '2019-03-08' });
  // 3 — inherited gold coins in Nepal locker, NPR, outdated valuation
  const c = mk({ id: 'COI-2026-00001', name: 'Gold Asarphi coins (5 pcs)', cat: 'COI', description: 'Family gold coins, 10 g each', acquisition: 'Inherited', acquiredDate: '2012-10-24', currency: 'NPR', ownerId: me.id, ownershipType: 'Family', ownershipPct: 50, coOwnerIds: [sp.id], beneficiaryIds: [ch.id], locationId: lockerNp.id, details: { issuingCountry: 'Nepal', quantity: 5, metalType: 'Gold', purity: 999, karat: '999 / 24K', grossWeight: 50, netMetalWeight: 50 } });
  addValuation({ itemId: c.id, type: 'Estimated', value: 600000, currency: 'NPR', date: '2022-01-15', source: 'Owner estimate' });
  // 4 — painting at home, partially documented
  const a = mk({ id: 'ART-2026-00001', name: 'Himalayan landscape, oil on canvas', cat: 'ART', description: 'Oil on canvas, 80 × 60 cm, signed lower right', purchaseDate: '2023-09-30', purchasePrice: 2800, seller: 'Sample Gallery Kathmandu', purchaseCountry: 'Nepal', ownerId: me.id, locationId: home.id, policyId: pol.id, details: { artist: 'Sample Artist', title: 'Evening over Annapurna', creationYear: '2021', medium: 'Oil on canvas', signature: 'Signed front', length: 800, height: 600 } });
  addValuation({ itemId: a.id, type: 'Estimated', value: 3200, currency: 'EUR', date: '2025-12-01', source: 'Owner estimate' });
  await sampleAttach(a, 'photo', 'painting-front.jpg', await samplePhoto(`${a.id} Front`, 30, 'art'), { view: 'Front', caption: '', photoDate: '2025-12-01', photoDateSource: 'sample' });
  // 5 — watch, little documentation
  mk({ id: 'WAT-2026-00001', name: 'Automatic wristwatch', cat: 'WAT', description: 'Stainless steel, 40 mm', brand: 'Sample Watch Co.', model: 'Explorer 40', serial: 'SWC-88214', purchaseDate: '2022-12-20', purchasePrice: 6900, ownerId: me.id, details: { reference: '214270', boxPapers: 'Box and papers', metalType: 'Steel' } });
  S.verifications.push({ id: uid(), sample: true, type: 'Locker inspection witnessed', witness: wit.name, relationship: 'friend', date: '2026-05-20', place: 'Sample Sparkasse, main branch', locationId: locker.id, itemIds: [n.id], comments: 'Necklace inspected, weighed (52.4 g) and photographed in the locker room.', signature: '', recorded: nowISO() });
  S.verifications.push({ id: uid(), sample: true, type: 'Inventory witnessed', witness: wit.name, relationship: 'friend', date: '2025-11-02', place: 'Home', itemIds: [r.id], comments: '', signature: '', recorded: nowISO() });
  audit('Sample data loaded', 'vault', '', '', '5 items'); await saveNow();
}
async function removeSampleData() {
  const ids = new Set(S.items.filter(i => i.sample).map(i => i.id));
  for (const f of S.files.filter(f => ids.has(f.itemId))) await delBlob(f.id);
  S.files = S.files.filter(f => !ids.has(f.itemId)); S.items = S.items.filter(i => !i.sample); S.valuations = S.valuations.filter(v => !ids.has(v.itemId));
  S.verifications = S.verifications.filter(v => !v.sample); S.policies = S.policies.filter(p => !p.sample); S.locations = S.locations.filter(l => !l.sample);
  S.people = S.people.filter(p => !p.sample || S.items.some(i => i.ownerId === p.id));
  audit('Sample data removed', 'vault', '', '', `${ids.size} items`); await saveNow();
}

/* ---------- actions ---------- */
const ACT = {
  nav: a => go(a.dataset.view), 'nav-toggle': () => $('#app').classList.toggle('navopen'),
  'nav-edit': a => go('edit', { id: a.dataset.id }), 'nav-inv': a => go('inventory', { loc: a.dataset.loc, owner: a.dataset.owner }),
  lock: () => { lockVault(); renderLock('Vault locked.'); }, scan: scanQR, reveal,
  'open-item': a => a.dataset.id && go('item', { id: a.dataset.id, tab: a.dataset.tab }), 'item-tab': a => go('item', { ...PARAMS, tab: a.dataset.tab }),
  sel: a => { a.checked ? SEL.add(a.dataset.id) : SEL.delete(a.dataset.id); }, 'sel-all': a => { $$('input[data-act=sel]').forEach(c => { c.checked = a.checked; a.checked ? SEL.add(c.dataset.id) : SEL.delete(c.dataset.id); }); },
  alert: a => go('inventory', { alert: a.dataset.kind }), 'alert-sys': a => go({ 'sys-policy': 'insurance', 'sys-locker': 'locations', 'sys-fx': 'settings', 'sys-backup': 'backup' }[a.dataset.kind] || 'dashboard'),
  'inv-bin': () => go('inventory', { bin: 1 }),
  'quick-person': () => editPerson(null, id => { const s = $('[name=ownerId]'); s.insertAdjacentHTML('beforeend', `<option value="${id}">${esc(personName(id))}</option>`); s.value = id; }),
  'delete-item': async a => { const it = item(a.dataset.id); if (await confirmBox('Move to recycle bin', `Move <b>${esc(it.id)} ${esc(it.name)}</b> to the recycle bin? It can be restored.`, 'Move to bin', true)) { it.deleted = true; it.deletedAt = nowISO(); audit('Deleted (soft)', 'item', it.id, '', ''); saveSoon(); go('inventory'); } },
  'restore-item': a => { const it = item(a.dataset.id); it.deleted = false; delete it.deletedAt; audit('Restored', 'item', it.id, '', ''); saveSoon(); rerender(); },
  'purge-item': async a => { const it = item(a.dataset.id); if (!(await confirmBox('Delete permanently', `Permanently delete <b>${esc(it.id)}</b> with all its photos, documents and valuations? This cannot be undone.`, 'Delete permanently', true))) return; if (!(await askPassword())) return;
    for (const f of S.files.filter(f => f.itemId === it.id)) await delBlob(f.id); S.files = S.files.filter(f => f.itemId !== it.id); S.valuations = S.valuations.filter(v => v.itemId !== it.id); S.items = S.items.filter(i => i !== it); audit('Deleted permanently', 'item', it.id, it.name, ''); saveSoon(); rerender(); },
  'open-file': a => openFile(a.dataset.id), 'dl-file': a => { audit('Decrypted file downloaded', 'file', byId(S.files, a.dataset.id)?.itemId, '', byId(S.files, a.dataset.id)?.name); saveSoon(); },
  'del-file': async a => { const f = byId(S.files, a.dataset.id); if (!(await confirmBox('Remove file', `Remove ${esc(f.name)}? The encrypted file is deleted.`, 'Remove', true))) return; await delBlob(f.id); S.files = S.files.filter(x => x !== f); S.valuations.forEach(v => { if (v.docId === f.id) v.docId = ''; }); audit('File removed', 'item', f.itemId, f.name, ''); await saveNow(); rerender(); },
  'del-val': async a => { const v = byId(S.valuations, a.dataset.id); if (await confirmBox('Remove valuation', 'Remove this valuation record?', 'Remove', true)) { S.valuations = S.valuations.filter(x => x !== v); audit('Valuation removed', 'item', v.itemId, `${v.type} ${money(v.value, v.currency)}`, ''); saveSoon(); rerender(); } },
  'edit-location': a => editLocation(a.dataset.id), 'edit-person': a => editPerson(a.dataset.id), 'edit-policy': a => editPolicy(a.dataset.id),
  'new-verification': a => newVerification(a.dataset.items ? a.dataset.items.split(',') : [], a.dataset.loc || ''),
  'docs-kind': a => go('documents', { kind: a.dataset.kind }),
  report: a => { const { items, f } = repFilter(); buildReport(a.dataset.kind, items, f); },
  'item-report': a => buildReport('inventory', [item(a.dataset.id)], { photos: true, allPhotos: true }),
  'report-selected': () => buildReport('inventory', activeItems().filter(i => SEL.has(i.id)), { photos: true }),
  'export-selected': () => doExport(activeItems().filter(i => SEL.has(i.id)), 'xlsx', false),
  'locker-report': a => buildReport('locker', [], { locId: a.dataset.id }), 'ins-report': a => buildReport('insurance-one', [], { policyId: a.dataset.id }),
  'ver-report': a => buildReport('verification-one', [], { verId: a.dataset.id }), 'qr-labels': a => buildReport('qr', [item(a.dataset.id)], {}),
  'export-audit': () => { download(`audit-log-${stamp()}.csv`, toCSV(S.audit.map(a => ({ 'Date/Time': a.ts, User: a.user, Action: a.action, Entity: a.entity, Ref: a.ref, Field: a.field, Previous: a.prev, New: a.next })), S.settings.csvDelimiter), 'text/csv'); audit('Export performed', 'export', 'audit log', '', ''); saveSoon(); },
  'dl-template': () => { const ex = { ...flatItem({ id: '', name: 'Example: Gold bangle', cat: 'JWL', currency: 'EUR', details: {} }, false) }; for (const k of Object.keys(ex)) if (ex[k] === '') ex[k] = ''; download('valuables-import-template.csv', toCSV([ex], S.settings.csvDelimiter), 'text/csv'); },
  'imp-validate': importPreview, 'imp-run': importRun,
  'imp-errors': () => download(`import-errors-${stamp()}.csv`, toCSV(IMP.res.filter(r => r.errors.length || r.warns.length).map(r => ({ Row: r.n, 'Inventory ID': r.rec.id || '', Item: r.rec.name || '', Action: r.action, Errors: r.errors.join(' | '), Warnings: r.warns.join(' | ') })), S.settings.csvDelimiter), 'text/csv'),
  restore: () => restoreFlow(false), 'verify-backup': verifyBackupFile,
  'change-pw': () => { const d = modal('Change vault password', `<div class="grid"><label class="f">Current password<input type="password" id="cp-o"></label><label class="f">New password (min. 12)<input type="password" id="cp-n" autocomplete="new-password"></label><label class="f">Repeat<input type="password" id="cp-r" autocomplete="new-password"></label><div class="err" id="cp-e"></div></div>`, `<button class="btn" data-close>Cancel</button><button class="btn pri" data-ok>Change</button>`, { width: '460px' });
    $('[data-ok]', d).onclick = async () => { const o = $('#cp-o', d).value, n = $('#cp-n', d).value; if (n !== $('#cp-r', d).value) return $('#cp-e', d).textContent = 'New passwords differ.'; if (pwStrength(n) < 3) return $('#cp-e', d).textContent = 'New password too weak.'; try { await changePassword(o, n); saveSoon(); d.close(); toast('Password changed. Earlier backups keep their old password.'); } catch { $('#cp-e', d).textContent = 'Current password is wrong.'; } }; },
  'load-sample': async () => { await loadSampleData(); toast('Sample data loaded'); go('dashboard'); },
  'remove-sample': async () => { if (await confirmBox('Remove sample data', 'Remove all sample items, locations, policies and people?', 'Remove')) { await removeSampleData(); toast('Sample data removed'); go('dashboard'); } },
  persist: async () => { const ok = await navigator.storage?.persist?.(); toast(ok ? 'Persistent storage granted' : 'Browser declined — keep regular backups'); rerender(); },
  wipe: async () => { if (!(await confirmBox('Erase vault', 'This deletes <b>all</b> encrypted data from this browser. Only a backup can bring it back.', 'Continue', true))) return; if (!(await askPassword('Confirm erase'))) return; const d = await idb(); d.close(); _idb = null; lockVault(); await new Promise(r => { const q = indexedDB.deleteDatabase('valuables-vault'); q.onsuccess = q.onerror = q.onblocked = r; }); renderSetup(); },
};
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a || !ACT[a.dataset.act]) return; if (a.tagName === 'A' && a.dataset.act !== 'dl-file') e.preventDefault(); if (a.type === 'checkbox') { ACT[a.dataset.act](a, e); return; } ACT[a.dataset.act](a, e); });

/* ---------- idle auto-lock ---------- */
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, () => LAST_ACT = Date.now(), { passive: true, capture: true }));
setInterval(() => { if (KEY && S && Date.now() - LAST_ACT > S.settings.autoLockMin * 60000) { saveNow().finally(() => { lockVault(); $$('dialog').forEach(d => d.close()); renderLock('Locked automatically after inactivity.'); }); } }, 15000);
window.addEventListener('pagehide', () => { if (KEY) saveNow(); });

/* ---------- splash ---------- */
const SPLASH = document.getElementById('splash');
function hideSplash() {
  if (!SPLASH) return;
  if (!SPLASH.isConnected) document.body.appendChild(SPLASH); // body content was replaced by the first screen
  const wait = Math.max(0, 1300 - (Date.now() - (window.__SPLASH_T0 || 0)));
  setTimeout(() => { SPLASH.classList.add('out'); setTimeout(() => SPLASH.remove(), 600); }, wait);
}

/* ---------- boot ---------- */
(async function boot() {
  if (!window.crypto?.subtle || !window.indexedDB) { hideSplash(); document.body.innerHTML = '<div class="lock"><div class="card"><h1>Not supported</h1><p>This browser lacks Web Crypto or IndexedDB. Use a current Chrome, Edge, Firefox or Safari.</p></div></div>'; return; }
  const msg = document.getElementById('splash-msg'); if (msg) msg.textContent = 'Opening encrypted storage';
  try { (await vaultExists()) ? renderLock() : renderSetup(); } catch (e) { document.body.innerHTML = `<div class="lock"><div class="card"><h1>Storage unavailable</h1><p>${esc(e.message)}</p><p class="small">Private browsing windows often block storage. Open the file in a normal window.</p></div></div>`; }
  hideSplash();
})();
