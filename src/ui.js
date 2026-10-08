/* =====================================================================
   Valuables Vault — UI: shell, views, forms
   ===================================================================== */
let VIEW = 'dashboard', PARAMS = {}, SEL = new Set(), LAST_ACT = Date.now();
const ICON = {
  dashboard: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z', inventory: 'M4 6h16M4 12h16M4 18h10', add: 'M12 5v14M5 12h14',
  locations: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z', people: 'M16 11a4 4 0 1 0-8 0M3 21a9 9 0 0 1 18 0',
  valuations: 'M3 17l6-6 4 4 8-8M15 7h6v6', insurance: 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z', documents: 'M6 2h9l5 5v15H6zM14 2v6h6', verification: 'M9 12l2 2 4-4M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z',
  reports: 'M4 4h16v16H4zM8 15v-3M12 15V9M16 15v-5', import: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3', backup: 'M4 7l8-4 8 4v10l-8 4-8-4zM12 12v9M4 7l8 5 8-5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3a8 8 0 0 0-.1-1.3l2-1.6-2-3.4-2.4.9a8 8 0 0 0-2.2-1.3L15 3h-4l-.3 2.3a8 8 0 0 0-2.2 1.3l-2.4-.9-2 3.4 2 1.6A8 8 0 0 0 6 12', audit: 'M12 8v4l3 3M21 12a9 9 0 1 1-9-9'
};
const svgI = k => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k] || ''}"/></svg>`;
const LOGO = `<svg width="30" height="30" viewBox="0 0 32 32"><rect x="2" y="4" width="28" height="24" rx="4" fill="#24395a" stroke="#a8782b" stroke-width="1.5"/><circle cx="16" cy="16" r="6" fill="none" stroke="#d4a75a" stroke-width="1.8"/><path d="M16 10v3M16 19v3M10 16h3M19 16h3" stroke="#d4a75a" stroke-width="1.5"/><rect x="5" y="9" width="2" height="4" rx="1" fill="#d4a75a"/><rect x="5" y="19" width="2" height="4" rx="1" fill="#d4a75a"/></svg>`;
const BRAND_LOGO = window.__BRAND_LOGO || '';
const BRAND_HTML = `<div class="brandchip" role="contentinfo" aria-label="Powered by Ing.-Büro Sachit Shrestha">${BRAND_LOGO ? `<img src="${BRAND_LOGO}" alt="Team Nepal Solutions – Ing.-Büro Sachit Shrestha">` : ''}<span class="bt"><span class="pb">Powered by</span><b>© Ing.-Büro Sachit Shrestha</b><br><a href="mailto:support@medtec24.com">support@medtec24.com</a></span></div>`;
const NAV = [['dashboard', 'Dashboard'], ['inventory', 'Inventory'], ['add', 'Add item'], ['locations', 'Locations'], ['people', 'Owners & people'], ['valuations', 'Valuations'], ['insurance', 'Insurance'], ['documents', 'Documents'], ['verification', 'Verification'], ['reports', 'Reports'], ['sep'], ['import', 'Import / Export'], ['backup', 'Backup'], ['settings', 'Settings'], ['audit', 'Audit log']];

function toast(msg, ms = 3200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function applyTheme() { const t = S?.settings.theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }

/* ---------- modal helpers ---------- */
function modal(title, body, foot = '', opts = {}) {
  const d = document.createElement('dialog');
  d.innerHTML = `<div class="dlg-h"><h2 style="margin:0">${esc(title)}</h2><button class="btn ghost sm" data-close aria-label="Close">✕</button></div><div class="dlg-b">${body}</div>${foot ? `<div class="dlg-f">${foot}</div>` : ''}`;
  if (opts.width) d.style.maxWidth = opts.width;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('click', e => { if (e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => { d.remove(); opts.onClose && opts.onClose(); });
  return d;
}
function confirmBox(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise(res => {
    let ok = false;
    const d = modal(title, `<p>${text}</p>`, `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okLabel)}</button>`, { onClose: () => res(ok), width: '480px' });
    $('[data-ok]', d).onclick = () => { ok = true; d.close(); };
  });
}
function askPassword(title = 'Confirm with your vault password', text = '') {
  return new Promise(res => {
    let val = null;
    const d = modal(title, `${text ? `<p>${text}</p>` : ''}<label class="f">Vault password<input type="password" id="ap-pw" autocomplete="current-password"></label><div class="err" id="ap-err"></div>`,
      `<button class="btn" data-close>Cancel</button><button class="btn pri" data-ok>Confirm</button>`, { onClose: () => res(val), width: '440px' });
    const go = async () => { const pw = $('#ap-pw', d).value; if (await verifyPassword(pw)) { val = pw; d.close(); } else $('#ap-err', d).textContent = 'Wrong password.'; };
    $('[data-ok]', d).onclick = go; $('#ap-pw', d).onkeydown = e => { if (e.key === 'Enter') go(); }; $('#ap-pw', d).focus();
  });
}
async function reveal(btn) {
  if (S.settings.revealNeedsPassword && !(await askPassword('Reveal confidential value'))) return;
  const span = btn.previousElementSibling; span.textContent = btn.dataset.val; btn.remove();
  audit('Confidential value revealed', btn.dataset.ent || '', btn.dataset.ref || '', '', '', btn.dataset.field || ''); saveSoon();
}
const masked = (v, ent, ref, field) => v ? `<span class="mask">${esc(mask(v))}</span> <button class="btn ghost sm" data-act="reveal" data-val="${esc(v)}" data-ent="${esc(ent)}" data-ref="${esc(ref)}" data-field="${esc(field)}">Show</button>` : '—';

/* ---------- lock / setup screens ---------- */
function pwStrength(p) {
  let s = 0; if (p.length >= 12) s++; if (p.length >= 16) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w]/.test(p)) s++; if (/\s/.test(p) && p.length >= 20) s++;
  return Math.min(s, 5);
}
function renderSetup() {
  document.body.innerHTML = `<div class="lock"><div class="card">
    <h1>${LOGO} Valuables Vault</h1>
    <p class="muted">Create the vault password. It encrypts every record, photo and document on this device. <b>It cannot be recovered</b> — store it in a password manager or sealed with your estate papers.</p>
    <form id="setup" class="grid">
      <label class="f">Your name (shown in reports and the audit log)<input id="su-name" required value=""></label>
      <label class="f">Vault password (min. 12 characters — a passphrase is best)<input type="password" id="su-pw" autocomplete="new-password" required minlength="12"><div class="strength"><i id="su-str"></i></div></label>
      <label class="f">Repeat password<input type="password" id="su-pw2" autocomplete="new-password" required></label>
      <label class="row small"><input type="checkbox" class="chk" id="su-sample" checked> Load sample data (gold necklace JWL-2026-00001 and four more items) — remove any time in Settings</label>
      <div class="err" id="su-err"></div>
      <button class="btn pri" type="submit">Create encrypted vault</button>
    </form>
    <p class="small muted" style="margin-top:14px">Data stays on this device (browser storage, AES-256-GCM, PBKDF2 ${PBKDF2_ITER.toLocaleString()} iterations). Nothing is sent to any server.</p>
  </div></div><div class="lock-brand">${BRAND_HTML}</div>`;
  const pw = $('#su-pw'); pw.oninput = () => { const s = pwStrength(pw.value); const c = ['#b23a3a', '#b23a3a', '#c9822b', '#c9a22b', '#2f7d4f', '#2f7d4f'][s]; $('#su-str').style.cssText = `width:${s * 20}%;background:${c}`; };
  $('#setup').onsubmit = async e => {
    e.preventDefault();
    const p1 = pw.value, p2 = $('#su-pw2').value;
    if (p1 !== p2) return $('#su-err').textContent = 'Passwords do not match.';
    if (pwStrength(p1) < 3) return $('#su-err').textContent = 'Password too weak — use a longer passphrase with mixed characters.';
    $('#su-err').textContent = 'Creating vault…';
    await createVault(p1);
    S.settings.userName = $('#su-name').value.trim() || 'Vault owner';
    if ($('#su-sample').checked) await loadSampleData();
    await saveNow(); navigator.storage?.persist?.();
    startShell();
  };
}
function renderLock(msg = '') {
  document.body.innerHTML = `<div class="lock"><div class="card">
    <h1>${LOGO} Valuables Vault</h1>
    <p class="muted">${msg || 'Vault is locked.'}</p>
    <form id="unl" class="grid">
      <label class="f">Vault password<input type="password" id="ul-pw" autocomplete="current-password" autofocus></label>
      <div class="err" id="ul-err"></div>
      <button class="btn pri" type="submit">Unlock</button>
    </form>
    <p class="small muted" style="margin-top:14px">Forgot the password? The data cannot be decrypted without it. Restore from an encrypted backup whose password you know: <a href="#" id="ul-restore">restore backup</a>.</p>
  </div></div><div class="lock-brand">${BRAND_HTML}</div>`;
  $('#ul-pw').focus();
  $('#unl').onsubmit = async e => {
    e.preventDefault(); $('#ul-err').textContent = 'Unlocking…';
    try { await unlockVault($('#ul-pw').value); startShell(); } catch (err) { $('#ul-err').textContent = err.message; }
  };
  $('#ul-restore').onclick = e => { e.preventDefault(); restoreFlow(true); };
}

/* ---------- shell ---------- */
function startShell() {
  applyTheme();
  document.body.innerHTML = `<div class="app" id="app">
    <aside class="side"><div class="brandmark">${LOGO}<div>Valuables Vault<small>Inventory · Evidence · Insurance</small></div></div><nav class="nav" id="nav"></nav></aside>
    <div class="main">
      <header class="top">
        <button class="btn sm mobile-only" data-act="nav-toggle" aria-label="Menu">☰</button>
        <input class="search" id="gsearch" placeholder="Search ID, name, serial, certificate, owner…" aria-label="Search inventory">
        <button class="btn sm" data-act="scan" title="Open a record by scanning its QR label">Scan QR</button>
        <span class="grow"></span>
        <span class="pill info" title="All data is stored encrypted on this device only. Cloud sync is off.">●<span class="hide-m"> Local data · encrypted · sync off</span></span>
        <button class="btn sm" data-act="lock">Lock</button>
      </header>
      <section class="content" id="content"></section>
      <footer class="brandfoot">${BRAND_HTML}</footer>
    </div></div>`;
  $('#gsearch').addEventListener('keydown', e => { if (e.key === 'Enter') go('inventory', { q: e.target.value }); });
  go(VIEW === 'item' && !item(PARAMS.id) ? 'dashboard' : VIEW, PARAMS);
}
function renderNav() {
  const al = computeAlerts().filter(a => a.sev === 'bad').length;
  $('#nav').innerHTML = NAV.map(([k, l]) => k === 'sep' ? '<div class="sep"></div>' :
    `<button data-act="nav" data-view="${k}" class="${VIEW === k || (k === 'inventory' && VIEW === 'item') ? 'on' : ''}">${svgI(k)}${l}${k === 'dashboard' && al ? `<span class="badge">${al}</span>` : ''}</button>`).join('');
}
function go(view, params = {}) {
  VIEW = view; PARAMS = params; $('#app')?.classList.remove('navopen');
  renderNav();
  const c = $('#content'); const fn = VIEWS[view] || VIEWS.dashboard;
  c.innerHTML = fn(params) || ''; window.scrollTo(0, 0);
  AFTER[view]?.(params);
}
const rerender = () => go(VIEW, PARAMS);

/* ---------- generic field rendering ---------- */
function fieldHTML(f, val, name, extra = '') {
  const id = 'f_' + name.replace(/\W/g, '_');
  const lab = `<span class="${f.required ? 'req' : ''}">${esc(f.label)}</span>`;
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${name}" ${extra}>${(f.options || []).map(o => `<option value="${esc(o)}" ${String(val ?? '') === o ? 'selected' : ''}>${esc(o || '—')}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${name}" ${extra}>${esc(val)}</textarea>`;
  else input = `<input id="${id}" name="${name}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(val)}" ${f.required ? 'required' : ''} ${extra}>`;
  return `<label class="f ${f.type === 'textarea' ? 'wide' : ''}" for="${id}">${lab}${input}${hint}</label>`;
}
const sel = (name, opts, val, extra = '') => `<select name="${name}" ${extra}>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(val ?? '') === String(v) ? 'selected' : ''}>${esc(l || '—')}</option>`; }).join('')}</select>`;
function formObj(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'file') continue;
    if (el.type === 'radio' && !el.checked) continue;
    let v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' && el.multiple ? [...el.selectedOptions].map(x => x.value) : el.value;
    if (typeof v === 'string') v = v.trim();
    const parts = el.name.split('.'); let t = o;
    while (parts.length > 1) { const p = parts.shift(); t = t[p] = t[p] || {}; }
    t[parts[0]] = v;
  }
  return o;
}
const peopleOpts = (blank = true) => [...(blank ? [['', '—']] : []), ...S.people.map(p => [p.id, p.name])];
const locOpts = () => [['', '—'], ...S.locations.map(l => [l.id, `${l.name} (${l.type})`])];
const polOpts = () => [['', '— none —'], ...S.policies.map(p => [p.id, `${p.insurer} · ${p.type || ''}`])];
const curOpts = () => SCHEMA.currencies;
const catOpts = () => Object.entries(SCHEMA.categories).map(([k, v]) => [k, `${v.name} (${k})`]);

/* ---------- item card helpers ---------- */
function thumbOf(it) { const p = itemFiles(it, 'photo')[0]; return p?.thumb || ''; }
function itemRow(it, opts = {}) {
  const v = itemVals(it), sc = itemScore(it).score, l = loc(it.locationId);
  return `<tr class="click" data-act="open-item" data-id="${esc(it.id)}">
    ${opts.select ? `<td><input type="checkbox" class="chk" data-act="sel" data-id="${esc(it.id)}" ${SEL.has(it.id) ? 'checked' : ''}></td>` : ''}
    <td><div class="row" style="flex-wrap:nowrap">${thumbOf(it) ? `<img src="${thumbOf(it)}" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:6px">` : `<span style="width:38px;height:38px;border-radius:6px;background:var(--panel-2);display:inline-block"></span>`}
      <div><b>${esc(it.name)}</b><div class="mono muted">${esc(it.id)}</div></div></div></td>
    <td>${esc(catName(it.cat))}</td><td>${esc(personName(it.ownerId) || '—')}</td>
    <td>${l ? esc(l.name) + (isLocker(l) ? ' <span class="pill small">locker</span>' : '') : '<span class="muted">—</span>'}</td>
    <td class="num">${v.purchase != null ? money(v.purchase, it.currency) : '—'}</td>
    <td class="num">${v.current ? money(v.current.value, v.current.currency) : '<span class="muted">—</span>'}</td>
    <td class="num">${v.insurance ? money(v.insurance.value, v.insurance.currency) : '<span class="muted">—</span>'}</td>
    <td style="min-width:120px">${scoreBar(sc)}</td></tr>`;
}
const itemTableHead = (select) => `<thead><tr>${select ? '<th><input type="checkbox" class="chk" data-act="sel-all" aria-label="Select all"></th>' : ''}<th>Item</th><th>Category</th><th>Owner</th><th>Location</th><th class="num">Purchase</th><th class="num">Current value</th><th class="num">Insurance value</th><th>Documentation</th></tr></thead>`;

/* =====================================================================
   VIEWS
   ===================================================================== */
const VIEWS = {}, AFTER = {};

VIEWS.dashboard = () => {
  const items = activeItems(); const sum = f => items.reduce((a, it) => a + (f(it) || 0), 0);
  const tp = sum(i => itemVals(i).purchaseBase), tc = sum(i => itemVals(i).currentBase), ti = sum(i => itemVals(i).insuranceBase);
  const avg = items.length ? Math.round(items.reduce((a, i) => a + itemScore(i).score, 0) / items.length) : 0;
  const byCat = {}; for (const it of items) { const k = it.cat; byCat[k] = (byCat[k] || 0) + (itemVals(it).currentBase || 0); }
  const byLoc = {}; for (const it of items) { const l = loc(it.locationId); const k = l ? l.type : 'Unassigned'; byLoc[k] = byLoc[k] || { v: 0, n: 0 }; byLoc[k].v += itemVals(it).currentBase || 0; byLoc[k].n++; }
  const maxC = Math.max(1, ...Object.values(byCat)), maxL = Math.max(1, ...Object.values(byLoc).map(x => x.v));
  const alerts = computeAlerts();
  const coverage = S.policies.reduce((a, p) => a + (fx(p.coverage, p.currency) || 0), 0);
  return `<div class="row between"><h1>Dashboard</h1><div class="row"><button class="btn pri" data-act="nav" data-view="add">+ Add item</button></div></div>
  ${!items.length ? `<div class="card empty"><h2>Your vault is empty</h2><p>Add your first valuable, import a CSV/Excel list, or load the sample data in Settings.</p><div class="row" style="justify-content:center"><button class="btn pri" data-act="nav" data-view="add">Add item</button><button class="btn" data-act="nav" data-view="import">Import</button></div></div>` : ''}
  <div class="grid g4" style="margin-top:10px">
    <div class="card kpi"><div class="l">Items</div><div class="v">${items.length}</div><div class="s">Avg. documentation ${avg}%</div></div>
    <div class="card kpi"><div class="l">Purchase value</div><div class="v">${moneyBase(tp)}</div><div class="s">Historic cost</div></div>
    <div class="card kpi"><div class="l">Current est. value</div><div class="v">${moneyBase(tc)}</div><div class="s">Latest market / appraised / estimate</div></div>
    <div class="card kpi"><div class="l">Insurance value</div><div class="v">${moneyBase(ti)}</div><div class="s">${S.policies.length ? `Policies total ${moneyBase(coverage)}` : 'No policy recorded'}</div></div>
  </div>
  <p class="small muted" style="margin:8px 2px 0">Market value and insurance / replacement value are different things: replacing a piece at retail usually costs more than it would fetch on resale. Totals in ${S.settings.baseCurrency}.</p>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>By category (current value)</h3>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span>${esc(catName(k))}</span><span class="t"><i style="width:${v / maxC * 100}%"></i></span><span class="num">${moneyBase(v)}</span></div>`).join('') || '<p class="muted">No data</p>'}</div>
    <div class="card"><h3>By storage location</h3>${Object.entries(byLoc).sort((a, b) => b[1].v - a[1].v).map(([k, v]) => `<div class="hbar"><span>${esc(k)} <span class="muted small">(${v.n})</span></span><span class="t"><i class="acc" style="width:${v.v / maxL * 100}%"></i></span><span class="num">${moneyBase(v.v)}</span></div>`).join('') || '<p class="muted">No data</p>'}</div>
  </div>
  <div class="card" style="margin-top:14px"><div class="row between"><h3 style="margin:0">Alerts</h3><span class="muted small">${alerts.length} open</span></div><div style="margin-top:10px">
  ${alerts.map(a => `<div class="alert ${a.sev}" data-act="${a.kind.startsWith('sys') ? 'alert-sys' : 'alert'}" data-kind="${a.kind}"><span class="n">${a.ids.length || '!'}</span><span>${esc(a.text)}</span></div>`).join('') || '<p class="muted">Nothing needs attention. Well documented.</p>'}
  </div></div>`;
};

VIEWS.inventory = (p) => {
  const q = (p.q || '').toLowerCase();
  let items = p.bin ? S.items.filter(i => i.deleted) : activeItems();
  if (q) items = items.filter(it => {
    const hay = [it.id, it.name, it.serial, it.idNumber, it.brand, it.model, it.description, it.invoiceNo, personName(it.ownerId), locName(it.locationId), catName(it.cat), ...Object.values(it.details || {})].join(' ').toLowerCase();
    return hay.includes(q);
  });
  if (p.cat) items = items.filter(i => i.cat === p.cat);
  if (p.owner) items = items.filter(i => i.ownerId === p.owner || (i.coOwnerIds || []).includes(p.owner));
  if (p.loc) items = items.filter(i => i.locationId === p.loc);
  if (p.ins === 'insured') items = items.filter(i => itemPolicies(i).length); else if (p.ins === 'uninsured') items = items.filter(i => !itemPolicies(i).length);
  if (p.vmin) items = items.filter(i => (itemVals(i).currentBase || 0) >= +p.vmin);
  if (p.vmax) items = items.filter(i => (itemVals(i).currentBase || 0) <= +p.vmax);
  if (p.from) items = items.filter(i => (i.purchaseDate || i.acquiredDate || '') >= p.from);
  if (p.to) items = items.filter(i => (i.purchaseDate || i.acquiredDate || '') <= p.to);
  if (p.alert) { const a = computeAlerts().find(x => x.kind === p.alert); const ids = new Set(a ? a.ids : []); items = items.filter(i => ids.has(i.id)); }
  const sorts = { id: (a, b) => a.id.localeCompare(b.id), name: (a, b) => a.name.localeCompare(b.name), value: (a, b) => (itemVals(b).currentBase || 0) - (itemVals(a).currentBase || 0), score: (a, b) => itemScore(a).score - itemScore(b).score, date: (a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || '') };
  items.sort(sorts[p.sort || 'id']);
  const alertTxt = p.alert ? computeAlerts().find(x => x.kind === p.alert)?.text : '';
  return `<div class="row between"><h1>${p.bin ? 'Deleted items (recycle bin)' : 'Inventory'}</h1><div class="row">
      ${p.bin ? '<button class="btn" data-act="nav" data-view="inventory">← Back to inventory</button>' : `<button class="btn" data-act="inv-bin">Recycle bin (${S.items.filter(i => i.deleted).length})</button><button class="btn pri" data-act="nav" data-view="add">+ Add item</button>`}</div></div>
    <form id="invf" class="card" style="margin:10px 0 14px"><div class="fields">
      <label class="f">Search<input name="q" value="${esc(p.q || '')}" placeholder="ID, name, serial, certificate no.…"></label>
      <label class="f">Category${sel('cat', [['', 'All'], ...catOpts()], p.cat)}</label>
      <label class="f">Owner${sel('owner', [['', 'All'], ...S.people.map(x => [x.id, x.name])], p.owner)}</label>
      <label class="f">Location / locker${sel('loc', [['', 'All'], ...S.locations.map(x => [x.id, x.name])], p.loc)}</label>
      <label class="f">Insurance${sel('ins', [['', 'All'], ['insured', 'Insured'], ['uninsured', 'Not insured']], p.ins)}</label>
      <label class="f">Current value from (${S.settings.baseCurrency})<input name="vmin" type="number" value="${esc(p.vmin || '')}"></label>
      <label class="f">to<input name="vmax" type="number" value="${esc(p.vmax || '')}"></label>
      <label class="f">Purchased from<input name="from" type="date" value="${esc(p.from || '')}"></label>
      <label class="f">to<input name="to" type="date" value="${esc(p.to || '')}"></label>
      <label class="f">Sort by${sel('sort', [['id', 'Inventory ID'], ['name', 'Name'], ['value', 'Value (high→low)'], ['score', 'Documentation (low→high)'], ['date', 'Purchase date (newest)']], p.sort)}</label>
    </div><div class="row" style="margin-top:10px"><button class="btn pri" type="submit">Apply</button><button class="btn" type="button" data-act="nav" data-view="inventory">Reset</button>
      ${alertTxt ? `<span class="pill warn">Alert filter: ${esc(alertTxt)}</span>` : ''}<span class="grow"></span><span class="muted small">${items.length} item(s) · ${SEL.size} selected</span>
      ${!p.bin && SEL.size ? `<button class="btn sm" type="button" data-act="export-selected">Export selected</button><button class="btn sm" type="button" data-act="report-selected">Report for selected</button>` : ''}</div></form>
    ${items.length ? `<div class="tablewrap"><table>${itemTableHead(!p.bin)}<tbody>${p.bin ? items.map(it => `<tr><td><b>${esc(it.name)}</b><div class="mono muted">${esc(it.id)}</div></td><td>${esc(catName(it.cat))}</td><td colspan="5" class="muted">Deleted ${fmtTs(it.deletedAt)}</td><td colspan="2"><button class="btn sm" data-act="restore-item" data-id="${esc(it.id)}">Restore</button> <button class="btn sm danger" data-act="purge-item" data-id="${esc(it.id)}">Delete permanently</button></td></tr>`).join('') : items.map(it => itemRow(it, { select: true })).join('')}</tbody></table></div>` : `<div class="card empty">No items match.</div>`}`;
};
AFTER.inventory = (p) => {
  $('#invf').onsubmit = e => { e.preventDefault(); const o = formObj(e.target); if (p.bin) o.bin = 1; if (p.alert) o.alert = p.alert; go('inventory', o); };
};

/* ---------- add / edit item ---------- */
VIEWS.add = (p) => VIEWS.edit({});
VIEWS.edit = (p) => {
  const it = p.id ? structuredClone(item(p.id)) : { cat: p.cat || 'JWL', currency: S.settings.baseCurrency, acquisition: 'Purchased', ownershipType: 'Sole', ownershipPct: 100, details: {}, coOwnerIds: [], beneficiaryIds: [] };
  const isNew = !p.id; const B = Object.fromEntries(SCHEMA.basicColumns.map(c => [c.k, c]));
  const f = (k, extra) => fieldHTML(B[k], it[k], k, extra);
  return `<div class="row between"><h1>${isNew ? 'Add valuable' : 'Edit ' + esc(it.id)}</h1><button class="btn" data-act="${isNew ? 'nav' : 'open-item'}" data-view="inventory" data-id="${esc(it.id || '')}">Cancel</button></div>
  <form id="itemf" style="margin-top:10px" novalidate>
    <fieldset><legend>What is it?</legend><div class="fields">
      <label class="f"><span class="req">Category</span>${sel('cat', catOpts(), it.cat, 'id="f_cat"')}</label>
      ${fieldHTML(B.name, it.name, 'name', 'required')}
      ${f('subcat')}${f('brand')}${f('manufacturer')}${f('model')}${f('serial')}${f('idNumber')}
      <label class="f wide">Description<textarea name="description">${esc(it.description)}</textarea></label>
      ${isNew ? `<label class="f">Inventory ID<input value="${esc(nextIdPreview(it.cat))}" disabled id="f_idprev"><span class="hint">Assigned automatically on save</span></label>` : ''}
    </div></fieldset>
    <div id="catfields">${catFieldsHTML(it.cat, it.details)}</div>
    <fieldset><legend>When and where was it acquired? What did it cost?</legend><div class="fields">
      <label class="f">Acquisition method${sel('acquisition', SCHEMA.acquisition, it.acquisition)}</label>
      ${f('acquiredDate')}${f('purchaseDate')}${f('purchasePrice')}
      <label class="f">Currency${sel('currency', curOpts(), it.currency)}</label>
      ${f('invoiceNo')}${f('seller')}${f('purchaseLocation')}${f('purchaseCountry')}
    </div></fieldset>
    <fieldset><legend>Who owns it?</legend><div class="fields">
      <label class="f"><span>Owner</span>${sel('ownerId', peopleOpts(), it.ownerId)}<span class="hint"><a href="#" data-act="quick-person">+ add person</a></span></label>
      <label class="f">Ownership type${sel('ownershipType', SCHEMA.ownershipTypes, it.ownershipType)}</label>
      ${f('ownershipPct')}
      <label class="f">Co-owners<select name="coOwnerIds" multiple size="3">${S.people.map(x => `<option value="${x.id}" ${(it.coOwnerIds || []).includes(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="f">Beneficiaries<select name="beneficiaryIds" multiple size="3">${S.people.map(x => `<option value="${x.id}" ${(it.beneficiaryIds || []).includes(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span class="hint">Ctrl / ⌘ + click for several</span></label>
    </div></fieldset>
    <fieldset><legend>Where is it stored and how is it insured?</legend><div class="fields">
      <label class="f">Storage location${sel('locationId', locOpts(), it.locationId)}<span class="hint"><a href="#" data-act="nav" data-view="locations">manage locations</a></span></label>
      <label class="f">Insurance policy${sel('policyId', polOpts(), it.policyId)}</label>
      ${isNew ? `<label class="f">Current estimated value<input name="_cur" type="number" step="any"><span class="hint">Creates an "Estimated" valuation dated today</span></label>
      <label class="f">Insurance / replacement value<input name="_ins" type="number" step="any"><span class="hint">Creates an "Insurance" valuation dated today</span></label>` : ''}
      <label class="f wide">Notes<textarea name="notes">${esc(it.notes)}</textarea></label>
    </div></fieldset>
    <div class="err" id="itemerr"></div>
    <div class="row"><button class="btn pri" type="submit">${isNew ? 'Create record' : 'Save changes'}</button>${isNew ? '<label class="row small"><input type="checkbox" class="chk" name="_another"> add another after saving</label>' : ''}</div>
  </form>`;
};
function nextIdPreview(cat) { const y = new Date().getFullYear(), pre = `${cat}-${y}-`; let max = S.counters[pre] || 0; for (const i of S.items) if (i.id.startsWith(pre)) max = Math.max(max, parseInt(i.id.slice(pre.length), 10)); return pre + String(max + 1).padStart(5, '0'); }
function catFieldsHTML(cat, details = {}) {
  const c = SCHEMA.categories[cat]; if (!c) return '';
  return c.groups.map(g => { const G = SCHEMA.groups[g]; return `<fieldset><legend>${esc(G.title)}</legend><div class="fields">${G.fields.map(fd => fieldHTML(fd, details?.[fd.k], 'details.' + fd.k)).join('')}</div>${g === 'metal' ? '<p class="small muted" id="metalcalc" style="margin:8px 0 0"></p>' : ''}</fieldset>`; }).join('');
}
function bindMetalCalc() {
  const pur = $('[name="details.purity"]'), kar = $('[name="details.karat"]'); const out = $('#metalcalc');
  const upd = () => {
    if (pur && kar && pur.value && (!kar.value || kar.dataset.auto)) { kar.value = karatFromPurity(pur.value); kar.dataset.auto = 1; }
    if (!out) return; const w = +$('[name="details.netMetalWeight"]')?.value || +$('[name="details.grossWeight"]')?.value || 0; const p = +pur?.value || 0; const pr = +$('[name="details.metalPriceCurrent"]')?.value || 0;
    out.textContent = w && p ? `Fine metal content ≈ ${(w * p / 1000).toFixed(2)} g${pr ? ` · intrinsic metal value ≈ ${(w * p / 1000 * pr).toFixed(0)} (per-gram price × fine weight; excludes workmanship and stones — not a market or insurance value)` : ''}` : '';
  };
  $$('#catfields input').forEach(i => i.addEventListener('input', upd)); kar?.addEventListener('input', () => delete kar.dataset.auto); upd();
}
AFTER.add = () => AFTER.edit({});
AFTER.edit = (p) => {
  const form = $('#itemf');
  $('#f_cat').onchange = e => { const cur = formObj(form).details || {}; $('#catfields').innerHTML = catFieldsHTML(e.target.value, cur); bindMetalCalc(); if ($('#f_idprev')) $('#f_idprev').value = nextIdPreview(e.target.value); };
  bindMetalCalc();
  form.onsubmit = e => { e.preventDefault(); saveItemForm(form, p.id); };
};
function validateItem(o, id) {
  const errs = [];
  if (!o.name) errs.push('Item name is required.');
  if (!SCHEMA.categories[o.cat]) errs.push('Choose a category.');
  for (const k of ['purchasePrice', 'ownershipPct', '_cur', '_ins']) if (o[k] !== '' && o[k] != null && isNaN(+o[k])) errs.push(`${k} must be a number.`);
  if (o.ownershipPct !== '' && (+o.ownershipPct < 0 || +o.ownershipPct > 100)) errs.push('Ownership % must be between 0 and 100.');
  if (o.purchasePrice !== '' && +o.purchasePrice < 0) errs.push('Purchase price cannot be negative.');
  if (o.purchaseDate && o.purchaseDate > todayISO()) errs.push('Purchase date is in the future.');
  if (o.serial) { const dup = S.items.find(i => i.id !== id && !i.deleted && i.serial && i.serial.toLowerCase() === o.serial.toLowerCase()); if (dup) errs.push(`Serial number already used by ${dup.id} (${dup.name}).`); }
  return errs;
}
function saveItemForm(form, id) {
  const o = formObj(form); const errs = validateItem(o, id);
  if (errs.length) { $('#itemerr').innerHTML = errs.map(esc).join('<br>'); return; }
  if (o.details?.purity && !o.details.karat) o.details.karat = karatFromPurity(o.details.purity);
  const clean = { ...o }; delete clean._cur; delete clean._ins; delete clean._another;
  clean.purchasePrice = clean.purchasePrice === '' ? '' : +clean.purchasePrice;
  clean.ownershipPct = clean.ownershipPct === '' ? '' : +clean.ownershipPct;
  for (const [k, v] of Object.entries(clean.details || {})) if (v === '') delete clean.details[k];
  if (!id) {
    const it = { ...clean, id: nextId(clean.cat), created: nowISO(), updated: nowISO() };
    S.items.push(it); audit('Created', 'item', it.id, '', it.name);
    if (o._cur) addValuation({ itemId: it.id, type: 'Estimated', value: +o._cur, currency: it.currency, date: todayISO(), source: 'Owner estimate at entry' });
    if (o._ins) addValuation({ itemId: it.id, type: 'Insurance', value: +o._ins, currency: it.currency, date: todayISO(), source: 'Owner entry' });
    saveSoon(); toast(`Created ${it.id}`);
    return o._another ? go('add', { cat: it.cat }) : go('item', { id: it.id, tab: 'photos' });
  }
  const it = item(id); const before = structuredClone(it);
  Object.assign(it, clean, { updated: nowISO() });
  diffAudit(before, it); saveSoon(); toast('Saved'); go('item', { id });
}
function diffAudit(a, b) {
  const label = { ownerId: 'Owner changed', locationId: 'Location changed', policyId: 'Insurance policy changed' };
  const show = (k, v) => k === 'ownerId' ? personName(v) : k === 'locationId' ? locName(v) : k === 'policyId' ? policy(v)?.insurer : Array.isArray(v) ? v.map(personName).join('; ') : v;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (['updated', 'details'].includes(k)) continue;
    if (JSON.stringify(a[k] ?? '') !== JSON.stringify(b[k] ?? '')) audit(label[k] || 'Edited', 'item', b.id, show(k, a[k]), show(k, b[k]), k);
  }
  const da = a.details || {}, db = b.details || {};
  for (const k of new Set([...Object.keys(da), ...Object.keys(db)])) if ((da[k] ?? '') !== (db[k] ?? '')) audit('Edited', 'item', b.id, da[k], db[k], 'details.' + k);
}
function addValuation(v) { const r = { id: uid(), ...v, created: nowISO() }; S.valuations.push(r); audit('Valuation added', 'item', v.itemId, '', `${v.type} ${money(v.value, v.currency)} (${fmtDate(v.date)})`); return r; }

/* ---------- item detail ---------- */
VIEWS.item = (p) => {
  const it = item(p.id); if (!it) return '<div class="card empty">Item not found.</div>';
  const tab = p.tab || 'overview'; const sc = itemScore(it); const v = itemVals(it);
  const tabs = [['overview', 'Overview'], ['valuations', `Valuations (${itemValuations(it).length})`], ['photos', `Photos (${itemFiles(it, 'photo').length})`], ['documents', `Documents (${itemFiles(it, 'doc').length})`], ['verification', `Verification (${S.verifications.filter(x => (x.itemIds || []).includes(it.id)).length})`], ['history', 'History']];
  return `<div class="row between"><div><div class="mono muted">${esc(it.id)}${it.deleted ? ' · <span class="pill bad">deleted</span>' : ''}</div><h1 style="margin:2px 0 4px">${esc(it.name)}</h1><div class="row small muted">${esc(catName(it.cat))}${it.subcat ? ' · ' + esc(it.subcat) : ''} · ${scoreBar(sc.score)} documented</div></div>
    <div class="row"><button class="btn" data-act="item-report" data-id="${esc(it.id)}">Evidence sheet (PDF)</button><button class="btn" data-act="nav-edit" data-id="${esc(it.id)}">Edit</button><button class="btn danger" data-act="delete-item" data-id="${esc(it.id)}">Delete</button></div></div>
    <div class="grid g4" style="margin-top:12px">
      <div class="card kpi"><div class="l">Purchase price</div><div class="v">${v.purchase != null ? money(v.purchase, it.currency) : '—'}</div><div class="s">${fmtDate(it.purchaseDate)}</div></div>
      <div class="card kpi"><div class="l">Current est. value</div><div class="v">${v.current ? money(v.current.value, v.current.currency) : '—'}</div><div class="s">${v.current ? `${v.current.type} · ${fmtDate(v.current.date)}${valuationOutdated(it) ? ' · <span class="status-u">outdated</span>' : ''}` : 'no valuation'}</div></div>
      <div class="card kpi"><div class="l">Insurance value</div><div class="v">${v.insurance ? money(v.insurance.value, v.insurance.currency) : '—'}</div><div class="s">${v.insurance ? `${v.insurance.type} · ${fmtDate(v.insurance.date)}` : 'not set'}</div></div>
      <div class="card kpi"><div class="l">Stored at</div><div class="v" style="font-size:17px">${esc(locName(it.locationId) || '—')}</div><div class="s">${esc(loc(it.locationId)?.type || '')}</div></div>
    </div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="item-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="itab">${ITEM_TABS[tab](it)}</div>`;
};
AFTER.item = (p) => { const it = item(p.id); if (it) ITEM_AFTER[p.tab || 'overview']?.(it); };
const ITEM_TABS = {}, ITEM_AFTER = {};
ITEM_TABS.overview = (it) => {
  const sc = itemScore(it); const d = it.details || {}; const groups = SCHEMA.categories[it.cat]?.groups || [];
  const kv = (l, v) => v !== '' && v != null && v !== '—' ? `<dt>${esc(l)}</dt><dd>${v}</dd>` : '';
  const mv = metalValue(it);
  return `<div class="grid g2">
    <div class="card"><h3>Identification</h3><dl class="kv">
      ${kv('Description', esc(it.description))}${kv('Brand', esc(it.brand))}${kv('Manufacturer', esc(it.manufacturer))}${kv('Model', esc(it.model))}${kv('Serial number', esc(it.serial))}${kv('Identification no.', esc(it.idNumber))}
    </dl>
    ${groups.map(g => { const G = SCHEMA.groups[g]; const rows = G.fields.filter(f => d[f.k] !== undefined && d[f.k] !== '').map(f => kv(f.label, f.sensitive ? masked(d[f.k], 'item', it.id, f.k) : f.type === 'date' ? fmtDate(d[f.k]) : esc(d[f.k]))).join(''); return rows ? `<h4 style="margin-top:14px">${esc(G.title)}</h4><dl class="kv">${rows}</dl>` : ''; }).join('')}
    ${mv ? `<p class="callout small" style="margin-top:12px">Fine metal ≈ <b>${mv.fine.toFixed(2)} g</b>; intrinsic metal value ≈ <b>${money(mv.value, it.currency)}</b> at ${money(+d.metalPriceCurrent, it.currency)}/g (${fmtDate(d.metalPriceDate)}). Metal value excludes craftsmanship and stones and is not the replacement value.</p>` : ''}
    </div>
    <div class="grid">
      <div class="card"><h3>Ownership & acquisition</h3><dl class="kv">
        ${kv('Owner', esc(personName(it.ownerId)) || '<span class="status-u">missing</span>')}${kv('Ownership', esc([it.ownershipType, it.ownershipPct !== '' ? it.ownershipPct + ' %' : ''].filter(Boolean).join(' · ')))}
        ${kv('Co-owners', esc((it.coOwnerIds || []).map(personName).join(', ')))}${kv('Beneficiaries', esc((it.beneficiaryIds || []).map(personName).join(', ')))}
        ${kv('Acquisition', esc(it.acquisition))}${kv('Date acquired', fmtDate(it.acquiredDate))}${kv('Purchase date', it.purchaseDate ? fmtDate(it.purchaseDate) : '')}
        ${kv('Seller / dealer', esc(it.seller))}${kv('Purchase location', esc([it.purchaseLocation, it.purchaseCountry].filter(Boolean).join(', ')))}${kv('Invoice no.', esc(it.invoiceNo))}
      </dl></div>
      <div class="card"><h3>Storage & insurance</h3><dl class="kv">
        ${kv('Location', esc(locName(it.locationId)) || '<span class="status-u">missing</span>')}
        ${kv('Insurance', itemPolicies(it).map(p => `${esc(p.insurer)} <span class="muted">(${esc(p.type || '')})</span>`).join('<br>') || '<span class="status-u">not insured</span>')}
        ${kv('Notes', esc(it.notes))}
      </dl></div>
      <div class="card"><div class="row between"><h3 style="margin:0">Documentation completeness</h3>${scoreBar(sc.score)}</div>
        <table style="margin-top:8px">${sc.checks.map(c => `<tr><td>${c.ok ? '✓' : '○'} ${esc(c.label)}</td><td class="num">${c.got}/${c.weight}</td><td class="small ${c.ok ? 'muted' : 'status-o'}">${esc(c.missing)}</td></tr>`).join('')}</table></div>
      <div class="card row" style="align-items:flex-start"><div class="qr">${qrSVG(it.id)}</div><div style="flex:1;min-width:180px"><h3>QR label</h3><p class="small muted">Contains only the reference <span class="mono">${esc(it.id)}</span> — no value, owner or location. Scanning opens the record only after the vault is unlocked.</p><button class="btn sm" data-act="qr-labels" data-id="${esc(it.id)}">Print label</button></div></div>
    </div></div>`;
};
function qrSVG(text) { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch { return ''; } }

ITEM_TABS.valuations = (it) => {
  const list = itemValuations(it);
  return `<div class="grid g2"><div class="card"><h3>Valuation history</h3>${valChart(list)}
    <p class="small muted">Market value is what the item would sell for; replacement / insurance value is the cost of buying an equivalent new. They are kept separately.</p></div>
    <form class="card" id="valf"><h3>Add valuation</h3><div class="fields">
      <label class="f"><span class="req">Type</span>${sel('type', SCHEMA.valuationTypes.filter(x => x !== 'Purchase'), 'Market')}</label>
      <label class="f"><span class="req">Value</span><input name="value" type="number" step="any" required></label>
      <label class="f">Currency${sel('currency', curOpts(), it.currency || S.settings.baseCurrency)}</label>
      <label class="f"><span class="req">Valuation date</span><input name="date" type="date" value="${todayISO()}" required></label>
      <label class="f">Source${sel('source', ['Professional valuer', 'Insurance appraisal', 'Dealer quote', 'Metal spot price', 'Auction result', 'Owner estimate', 'Other'], 'Professional valuer')}</label>
      <label class="f">Appraiser / valuer<input name="valuer"></label>
      <label class="f">Supporting document${sel('docId', [['', '—'], ...itemFiles(it, 'doc').map(f => [f.id, `${f.docType}: ${f.name}`])], '')}</label>
      <label class="f wide">Notes<input name="notes"></label></div>
      <div class="err" id="valerr"></div><button class="btn pri" type="submit">Add valuation</button></form></div>
    <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Date</th><th>Type</th><th class="num">Value</th><th>Currency</th><th>Source</th><th>Valuer</th><th>Document</th><th></th></tr></thead><tbody>
    ${list.slice().reverse().map(v => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.type)}</td><td class="num">${money(v.value, v.currency)}</td><td>${esc(v.currency)}</td><td>${esc(v.source)}</td><td>${esc(v.valuer)}</td><td>${v.docId ? `<a href="#" data-act="open-file" data-id="${v.docId}">${esc(byId(S.files, v.docId)?.name || 'file')}</a>` : ''}</td><td>${v.virtual ? '<span class="muted small">from purchase record</span>' : `<button class="btn ghost sm" data-act="del-val" data-id="${v.id}">Remove</button>`}</td></tr>`).join('')}
    </tbody></table></div>`;
};
ITEM_AFTER.valuations = (it) => {
  $('#valf').onsubmit = e => {
    e.preventDefault(); const o = formObj(e.target);
    if (isNaN(+o.value) || +o.value <= 0) return $('#valerr').textContent = 'Enter a positive value.';
    if (!o.date || o.date > todayISO()) return $('#valerr').textContent = 'Valuation date must be today or earlier.';
    addValuation({ itemId: it.id, ...o, value: +o.value }); saveSoon(); go('item', { id: it.id, tab: 'valuations' });
  };
};
function valChart(list) {
  const pts = list.filter(v => v.date && v.value).map(v => ({ ...v, b: fx(v.value, v.currency), t: new Date(v.date).getTime() })).filter(v => v.b != null);
  if (pts.length < 1) return '<p class="muted">No valuations yet.</p>';
  const W = 520, H = 200, P = 40; const t0 = Math.min(...pts.map(p => p.t)), t1 = Math.max(...pts.map(p => p.t)) || t0 + 1; const vmax = Math.max(...pts.map(p => p.b)) * 1.1, vmin = 0;
  const X = t => P + (t1 === t0 ? (W - 2 * P) / 2 : (t - t0) / (t1 - t0) * (W - 2 * P)), Y = v => H - 24 - (v - vmin) / (vmax - vmin) * (H - 44);
  const colors = { Purchase: '#7b8496', Market: '#1f3a5f', Replacement: '#a8782b', Insurance: '#c9822b', Appraised: '#2f7d4f', Estimated: '#6f9ad6' };
  const types = [...new Set(pts.map(p => p.type))];
  const lines = types.map(ty => { const ps = pts.filter(p => p.type === ty); return `<polyline fill="none" stroke="${colors[ty]}" stroke-width="2" points="${ps.map(p => `${X(p.t)},${Y(p.b)}`).join(' ')}"/>${ps.map(p => `<circle cx="${X(p.t)}" cy="${Y(p.b)}" r="4" fill="${colors[ty]}"><title>${p.type}: ${money(p.value, p.currency)} (${fmtDate(p.date)})</title></circle>`).join('')}`; }).join('');
  const grid = [0, .5, 1].map(f => { const v = vmin + f * (vmax - vmin); return `<line x1="${P}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/><text x="${P - 4}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${Math.round(v).toLocaleString()}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Valuation history chart" style="color:var(--ink)">${grid}${lines}
    <text x="${P}" y="${H - 6}" font-size="10" fill="currentColor" opacity=".6">${fmtDate(new Date(t0).toISOString())}</text><text x="${W - 10}" y="${H - 6}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${fmtDate(new Date(t1).toISOString())}</text></svg>
    <div class="row small">${types.map(t => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${colors[t]}"></span> ${t}</span>`).join('')} <span class="muted">(${S.settings.baseCurrency})</span></div>`;
}

ITEM_TABS.photos = (it) => {
  const ph = itemFiles(it, 'photo'); const have = new Set(ph.map(p => p.view));
  const suggested = ['Front', 'Rear', 'Detail', 'Serial number', 'Hallmark', 'Certificate', 'Storage location'].filter(v => !have.has(v));
  return `<form class="card" id="photof"><h3>Add photographs</h3><div class="fields">
      <label class="f">View${sel('view', SCHEMA.photoViews, suggested[0] || 'Detail')}</label>
      <label class="f">Caption<input name="caption" placeholder="e.g. clasp with 750 hallmark"></label>
      <label class="f">Photographer (optional)<input name="photographer"></label>
      <label class="f">Files<input type="file" name="files" accept="image/*,.heic,.heif" multiple capture="environment"></label></div>
      <div class="row" style="margin-top:10px"><button class="btn pri" type="submit">Upload & encrypt</button><span class="small muted">Suggested still missing: ${suggested.join(', ') || 'none'}</span></div></form>
    <div class="photos" style="margin-top:14px">${ph.map(f => `<div class="photo"><div class="img" data-act="open-file" data-id="${f.id}" style="${f.thumb ? `background-image:url(${f.thumb})` : ''}">${f.thumb ? '' : esc(f.name)}</div>
      <div class="meta"><b>${esc(f.view)}</b>${f.caption ? ' · ' + esc(f.caption) : ''}<div class="muted">Taken ${fmtDate(f.photoDate)} · uploaded ${fmtDate(f.uploadDate)}</div><div class="muted">${esc(f.name)} · ${fmtSize(f.size)}${f.exif?.camera ? ' · ' + esc(f.exif.camera) : ''}</div>
      <button class="btn ghost sm" data-act="del-file" data-id="${f.id}">Remove</button></div></div>`).join('') || '<div class="card empty">No photographs yet. Insurers typically ask for overall views plus close-ups of hallmarks, serial numbers and certificates.</div>'}</div>`;
};
ITEM_AFTER.photos = (it) => { $('#photof').onsubmit = async e => { e.preventDefault(); const o = formObj(e.target); const files = e.target.files.files; if (!files.length) return toast('Choose at least one image.'); await addFiles(it, files, 'photo', o); go('item', { id: it.id, tab: 'photos' }); }; };

ITEM_TABS.documents = (it) => {
  const docs = itemFiles(it, 'doc');
  return `<form class="card" id="docf"><h3>Add documents</h3><div class="fields">
      <label class="f">Document type${sel('docType', SCHEMA.docTypes, hasDoc(it, PURCHASE_DOCS) ? 'Certificate' : 'Purchase invoice')}</label>
      <label class="f">Reference / number<input name="ref"></label><label class="f">Document date<input type="date" name="docDate"></label>
      <label class="f">Files (PDF, JPG, PNG, HEIC, DOC/X, XLS/X)<input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx,.xls,.xlsx,image/*,application/pdf"></label></div>
      <button class="btn pri" type="submit" style="margin-top:10px">Upload & encrypt</button></form>
    <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Type</th><th>File</th><th>Reference</th><th>Date</th><th>Size</th><th>SHA-256</th><th></th></tr></thead><tbody>
    ${docs.map(f => `<tr><td>${esc(f.docType)}</td><td><a href="#" data-act="open-file" data-id="${f.id}">${esc(f.name)}</a></td><td>${esc(f.ref)}</td><td>${fmtDate(f.docDate || f.uploadDate)}</td><td>${fmtSize(f.size)}</td><td class="mono small" title="${f.sha256}">${(f.sha256 || '').slice(0, 12)}…</td><td><button class="btn ghost sm" data-act="del-file" data-id="${f.id}">Remove</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No documents. Upload the invoice, certificates and appraisals.</td></tr>'}
    </tbody></table></div><p class="small muted">The SHA-256 fingerprint lets you later prove a file has not been altered since it was archived.</p>`;
};
ITEM_AFTER.documents = (it) => { $('#docf').onsubmit = async e => { e.preventDefault(); const o = formObj(e.target); const files = e.target.files.files; if (!files.length) return toast('Choose a file.'); await addFiles(it, files, 'doc', o); go('item', { id: it.id, tab: 'documents' }); }; };

ITEM_TABS.verification = (it) => {
  const list = S.verifications.filter(v => (v.itemIds || []).includes(it.id));
  return `<div class="row between"><p class="muted" style="margin:0">A witness confirms that the item existed and was in your possession on a date — useful for claims and estate matters.</p><button class="btn pri" data-act="new-verification" data-items="${esc(it.id)}">+ Record verification</button></div>
    ${verTable(list)}`;
};
function verTable(list) {
  return `<div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Type</th><th>Witness</th><th>Relationship</th><th>Place</th><th>Items</th><th>Signature</th><th></th></tr></thead><tbody>
  ${list.map(v => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.type)}</td><td>${esc(v.witness)}</td><td>${esc(v.relationship)}</td><td>${esc(v.place)}${v.locationId ? `<div class="muted small">${esc(locName(v.locationId))}</div>` : ''}</td><td class="small">${(v.itemIds || []).length}</td><td>${v.signature ? `<img src="${v.signature}" alt="signature" style="height:34px;background:#fff;border-radius:4px">` : '<span class="muted small">on paper</span>'}</td><td><button class="btn sm" data-act="ver-report" data-id="${v.id}">Report</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No verification recorded.</td></tr>'}</tbody></table></div>`;
}
ITEM_TABS.history = (it) => auditTable(S.audit.filter(a => a.ref === it.id).slice().reverse());
function auditTable(rows) {
  return `<div class="tablewrap"><table><thead><tr><th>Date / time</th><th>User</th><th>Action</th><th>Ref</th><th>Field</th><th>Previous</th><th>New</th></tr></thead><tbody>
    ${rows.slice(0, 500).map(a => `<tr><td class="small">${fmtTs(a.ts)}</td><td class="small">${esc(a.user)}</td><td>${esc(a.action)}</td><td class="mono small">${esc(a.ref)}</td><td class="small">${esc(a.field)}</td><td class="small">${esc(a.prev)}</td><td class="small">${esc(a.next)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No entries.</td></tr>'}
    </tbody></table></div>${rows.length > 500 ? `<p class="small muted">Showing newest 500 of ${rows.length}. Export for the full log.</p>` : ''}`;
}

/* ---------- file handling ---------- */
async function addFiles(it, files, kind, o) {
  let n = 0;
  for (const file of files) {
    if (file.size > 60 * 1048576) { toast(`${file.name}: larger than 60 MB, skipped`); continue; }
    const buf = await file.arrayBuffer(); const id = uid();
    const meta = { id, itemId: it.id, kind, name: file.name, mime: file.type || guessMime(file.name), size: file.size, uploadDate: todayISO(), uploadTs: nowISO(), sha256: await sha256hex(buf) };
    if (kind === 'photo') {
      const ex = /jpe?g$/i.test(file.name) || file.type === 'image/jpeg' ? readExif(buf) : {};
      Object.assign(meta, { view: o.view, caption: o.caption, photographer: o.photographer, exif: ex, photoDate: ex.date || new Date(file.lastModified || Date.now()).toISOString().slice(0, 10), photoDateSource: ex.date ? 'EXIF' : 'file date', thumb: await makeThumb(file, 360) });
    } else Object.assign(meta, { docType: o.docType, ref: o.ref, docDate: o.docDate, thumb: file.type.startsWith('image/') ? await makeThumb(file, 360) : '' });
    await putBlob(id, buf); S.files.push(meta); n++;
    audit(kind === 'photo' ? 'Photograph added' : 'Document added', 'item', it.id, '', `${kind === 'photo' ? meta.view : meta.docType}: ${file.name}`);
  }
  await saveNow(); toast(`${n} file(s) encrypted and stored`);
}
function guessMime(n) { const e = n.split('.').pop().toLowerCase(); return { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }[e] || 'application/octet-stream'; }
function makeThumb(fileOrBlob, max) {
  return new Promise(res => {
    const url = URL.createObjectURL(fileOrBlob); const img = new Image();
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .8)); };
    img.onerror = () => { URL.revokeObjectURL(url); res(''); }; img.src = url;
  });
}
/** Minimal EXIF reader: DateTimeOriginal, Make, Model from JPEG APP1. */
function readExif(buf) {
  try {
    const v = new DataView(buf); if (v.getUint16(0) !== 0xFFD8) return {};
    let o = 2; while (o < v.byteLength - 4) {
      const m = v.getUint16(o), len = v.getUint16(o + 2);
      if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949; const g16 = p => v.getUint16(p, le), g32 = p => v.getUint32(p, le);
        const str = (p, n) => { let s = ''; for (let i = 0; i < n - 1; i++) { const c = v.getUint8(p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
        const out = {}; const readIFD = (ifd, depth) => {
          const n = g16(t + ifd); for (let i = 0; i < n; i++) {
            const e = t + ifd + 2 + i * 12, tag = g16(e), cnt = g32(e + 4), valOff = cnt > 4 ? t + g32(e + 8) : e + 8;
            if (tag === 0x010F) out.make = str(valOff, cnt); if (tag === 0x0110) out.model = str(valOff, cnt);
            if (tag === 0x9003) out.dto = str(valOff, cnt); if (tag === 0x8769 && depth < 2) readIFD(g32(e + 8), depth + 1);
          }
        };
        readIFD(g32(t + 4), 0);
        const r = {}; if (out.dto) { const mm = /^(\d{4}):(\d{2}):(\d{2})/.exec(out.dto); if (mm) r.date = `${mm[1]}-${mm[2]}-${mm[3]}`; r.dateTimeOriginal = out.dto; }
        if (out.make || out.model) r.camera = [out.make, out.model].filter(Boolean).join(' ').trim();
        return r;
      }
      if ((m & 0xFF00) !== 0xFF00) break; o += 2 + len;
    }
  } catch { } return {};
}
async function openFile(id) {
  const f = byId(S.files, id); if (!f) return;
  const url = await blobURL(f);
  const isImg = f.mime?.startsWith('image/') && !/heic|heif/i.test(f.mime), isPdf = f.mime === 'application/pdf';
  const body = isImg ? `<img src="${url}" alt="" style="max-width:100%;max-height:65vh;display:block;margin:auto">`
    : isPdf ? `<iframe src="${url}" title="${esc(f.name)}" style="width:100%;height:65vh;border:0"></iframe>`
      : `<p>No in-app preview for this file type (${esc(f.mime)}). Download the decrypted copy to open it.</p>`;
  modal(f.name, body + `<p class="small muted" style="margin-top:10px">${esc(f.kind === 'photo' ? `${f.view} · taken ${fmtDate(f.photoDate)} (${f.photoDateSource})` : f.docType)} · ${fmtSize(f.size)} · SHA-256 <span class="mono">${f.sha256}</span></p>`,
    `<a class="btn" href="${url}" download="${esc(f.name)}" data-act="dl-file" data-id="${f.id}">Download decrypted copy</a><button class="btn pri" data-close>Close</button>`);
}
