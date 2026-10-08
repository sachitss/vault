/* =====================================================================
   Valuables Vault — master data views: locations, people, insurance, valuations, documents, verification, audit, settings
   ===================================================================== */
VIEWS.locations = () => {
  const items = activeItems();
  return `<div class="row between"><h1>Storage locations</h1><button class="btn pri" data-act="edit-location">+ Add location</button></div>
  <p class="muted">Keep the inventory list and evidence somewhere other than the valuables themselves — if a fire or burglary hits one place, the proof survives in the other.</p>
  <div class="grid g2">${S.locations.map(l => {
    const c = items.filter(i => i.locationId === l.id); const val = c.reduce((a, i) => a + exposure(i), 0); const L = l.locker || {};
    const bi = fx(L.bankInsured, L.bankInsuredCurrency);
    return `<div class="card"><div class="row between"><div><h3 style="margin:0">${esc(l.name)}</h3><span class="pill">${esc(l.type)}</span> ${l.safe?.certified ? `<span class="pill ok">certified safe ${esc(l.safe.grade || '')}</span>` : ''}</div>
      <div class="row"><button class="btn sm" data-act="edit-location" data-id="${l.id}">Edit</button>${isLocker(l) ? `<button class="btn sm" data-act="locker-report" data-id="${l.id}">Locker report</button>` : ''}</div></div>
      <dl class="kv" style="margin-top:10px"><dt>Items</dt><dd>${c.length} · ${moneyBase(val)} (insurance/current)</dd>
      ${l.address ? `<dt>Address</dt><dd>${esc(l.address)}</dd>` : ''}
      ${isLocker(l) ? `<dt>Bank / branch</dt><dd>${esc(L.bank)} · ${esc(L.branch)}</dd><dt>Locker no.</dt><dd>${masked(L.number, 'location', l.id, 'locker.number')}</dd>
        <dt>Locker type</dt><dd>${esc(L.lockerType || '—')}</dd><dt>Agreement ref.</dt><dd>${masked(L.agreementRef, 'location', l.id, 'locker.agreementRef')}</dd>
        <dt>Holders</dt><dd>${esc((L.holderIds || []).map(personName).join(', ') || '—')}</dd><dt>Access authority</dt><dd>${esc(L.access || '—')}</dd>
        <dt>Bank-provided cover</dt><dd>${L.bankInsured ? money(L.bankInsured, L.bankInsuredCurrency) : '—'} ${bi != null && val > bi ? '<span class="pill bad">contents exceed</span>' : ''}<div class="small muted">${esc(L.insuranceNotes || '')}</div></dd>
        <dt>Last inspection</dt><dd>${fmtDate(L.lastInspection)}</dd><dt>Next review</dt><dd>${fmtDate(L.nextReview)} ${L.nextReview && daysUntil(L.nextReview) < 0 ? '<span class="pill warn">overdue</span>' : ''}</dd>` : ''}
      ${l.notes ? `<dt>Notes</dt><dd>${esc(l.notes)}</dd>` : ''}</dl>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="nav-inv" data-loc="${l.id}">Show contents</button>${isLocker(l) ? `<button class="btn sm" data-act="new-verification" data-loc="${l.id}">Record locker inspection</button>` : ''}</div></div>`;
  }).join('') || '<div class="card empty">No locations yet.</div>'}</div>
  <div class="callout warn" style="margin-top:14px"><b>Bank lockers are rented space, not insured deposits.</b> Banks generally do not know the contents and their liability or included cover is limited (in Germany typically a fixed sum per locker unless topped up; in India, bank liability under RBI rules is capped at 100× annual rent — Nepal banks set their own terms in the locker agreement). Statutory deposit protection does not apply to locker contents. Record the bank-provided cover here and check whether your own policy covers "Wertsachen im Bankschließfach".</div>`;
};
function locationForm(l) {
  const L = l.locker || {}, SF = l.safe || {};
  return `<form id="locf"><div class="fields">
    <label class="f"><span class="req">Name</span><input name="name" value="${esc(l.name)}" required></label>
    <label class="f">Type${sel('type', SCHEMA.locationTypes, l.type || 'Home', 'id="loctype"')}</label>
    <label class="f wide">Address / description<input name="address" value="${esc(l.address)}"></label></div>
    <fieldset style="margin-top:12px" id="safebox"><legend>Safe (Wertschutzschrank)</legend><div class="fields">
      <label class="row small"><input type="checkbox" class="chk" name="safe.certified" ${SF.certified ? 'checked' : ''}> Certified security safe (e.g. EN 1143-1) — many policies pay higher limits for valuables locked in one</label>
      <label class="f">Grade / standard<input name="safe.grade" value="${esc(SF.grade)}" placeholder="e.g. EN 1143-1 Grade I"></label><label class="f">Weight (kg) / anchored<input name="safe.weight" value="${esc(SF.weight)}"></label></div></fieldset>
    <fieldset id="lockerbox"><legend>Bank locker</legend><div class="fields">
      <label class="f">Bank<input name="locker.bank" value="${esc(L.bank)}"></label><label class="f">Branch<input name="locker.branch" value="${esc(L.branch)}"></label>
      <label class="f">Locker number (encrypted, shown masked)<input name="locker.number" value="${esc(L.number)}" autocomplete="off"></label><label class="f">Locker type / size<input name="locker.lockerType" value="${esc(L.lockerType)}"></label>
      <label class="f">Agreement reference<input name="locker.agreementRef" value="${esc(L.agreementRef)}" autocomplete="off"></label>
      <label class="f">Locker holders<select name="locker.holderIds" multiple size="3">${S.people.map(p => `<option value="${p.id}" ${(L.holderIds || []).includes(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="f">Access authority<input name="locker.access" value="${esc(L.access)}" placeholder="e.g. joint / either-or-survivor / nominee"></label>
      <label class="f">Bank-provided cover amount<input type="number" step="any" name="locker.bankInsured" value="${esc(L.bankInsured)}"></label><label class="f">Currency${sel('locker.bankInsuredCurrency', curOpts(), L.bankInsuredCurrency || S.settings.baseCurrency)}</label>
      <label class="f wide">Insurance notes (from locker agreement)<input name="locker.insuranceNotes" value="${esc(L.insuranceNotes)}"></label>
      <label class="f">Last inventory inspection<input type="date" name="locker.lastInspection" value="${esc(L.lastInspection)}"></label><label class="f">Next review date<input type="date" name="locker.nextReview" value="${esc(L.nextReview)}"></label></div></fieldset>
    <label class="f">Notes<textarea name="notes">${esc(l.notes)}</textarea></label><div class="err" id="locerr"></div></form>`;
}
function editLocation(id) {
  const l = id ? loc(id) : {};
  const d = modal(id ? 'Edit location' : 'Add location', locationForm(l), `${id ? '<button class="btn danger" data-del>Delete</button><span class="grow"></span>' : ''}<button class="btn" data-close>Cancel</button><button class="btn pri" data-save>Save</button>`);
  const sync = () => { const t = $('#loctype', d).value; $('#lockerbox', d).style.display = t === 'Bank locker' ? '' : 'none'; $('#safebox', d).style.display = /safe/i.test(t) ? '' : 'none'; };
  $('#loctype', d).onchange = sync; sync();
  $('[data-save]', d).onclick = () => {
    const o = formObj($('#locf', d)); if (!o.name) return $('#locerr', d).textContent = 'Name is required.';
    if (o.type !== 'Bank locker') delete o.locker; if (!/safe/i.test(o.type)) delete o.safe;
    if (o.locker?.bankInsured) o.locker.bankInsured = +o.locker.bankInsured;
    if (id) { const before = JSON.stringify(l); Object.assign(l, o); if (before !== JSON.stringify(l)) audit('Edited', 'location', l.name, '', ''); }
    else { const n = { id: uid(), ...o }; S.locations.push(n); audit('Created', 'location', n.name, '', n.type); }
    saveSoon(); d.close(); rerender();
  };
  $('[data-del]', d) && ($('[data-del]', d).onclick = async () => {
    const n = activeItems().filter(i => i.locationId === id).length;
    if (n) return toast(`${n} item(s) are still stored here — move them first.`);
    if (await confirmBox('Delete location', `Delete "${esc(l.name)}"?`, 'Delete', true)) { S.locations = S.locations.filter(x => x.id !== id); audit('Deleted', 'location', l.name, '', ''); saveSoon(); d.close(); rerender(); }
  });
}

VIEWS.people = () => `<div class="row between"><h1>Owners & people</h1><button class="btn pri" data-act="edit-person">+ Add person</button></div>
  <p class="muted">Owners, co-owners, beneficiaries, locker holders and witnesses. Keep only what you need (GDPR data minimisation) — a name and relationship is usually enough.</p>
  <div class="tablewrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Roles</th><th class="num">Owns</th><th class="num">Owned value</th><th class="num">Beneficiary of</th><th></th></tr></thead><tbody>
  ${S.people.map(p => { const own = activeItems().filter(i => i.ownerId === p.id); const ben = activeItems().filter(i => (i.beneficiaryIds || []).includes(p.id));
  return `<tr><td><b>${esc(p.name)}</b>${p.contact ? `<div class="small muted">${esc(p.contact)}</div>` : ''}</td><td>${esc(p.relationship)}</td><td class="small">${esc((p.roles || []).join(', '))}</td><td class="num">${own.length}</td><td class="num">${moneyBase(own.reduce((a, i) => a + (itemVals(i).currentBase || 0) * ((+i.ownershipPct || 100) / 100), 0))}</td><td class="num">${ben.length}</td>
    <td><button class="btn sm" data-act="edit-person" data-id="${p.id}">Edit</button> <button class="btn sm" data-act="nav-inv" data-owner="${p.id}">Assets</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">No people yet.</td></tr>'}
  </tbody></table></div>`;
function editPerson(id, after) {
  const p = id ? person(id) : { roles: ['Owner'] };
  const roles = ['Owner', 'Co-owner', 'Beneficiary', 'Locker holder', 'Witness', 'Valuer', 'Executor'];
  const d = modal(id ? 'Edit person' : 'Add person', `<form id="pf"><div class="fields">
    <label class="f"><span class="req">Name</span><input name="name" value="${esc(p.name)}" required></label>
    <label class="f">Relationship<input name="relationship" value="${esc(p.relationship)}" placeholder="self, spouse, daughter, notary…"></label>
    <label class="f">Contact (optional)<input name="contact" value="${esc(p.contact)}"></label>
    <label class="f">Roles<select name="roles" multiple size="4">${roles.map(r => `<option ${(p.roles || []).includes(r) ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <label class="f wide">Notes<input name="notes" value="${esc(p.notes)}"></label></div><div class="err" id="perr"></div></form>`,
    `${id ? '<button class="btn danger" data-del>Delete</button>' : ''}<button class="btn" data-close>Cancel</button><button class="btn pri" data-save>Save</button>`, { width: '620px' });
  $('[data-save]', d).onclick = () => {
    const o = formObj($('#pf', d)); if (!o.name) return $('#perr', d).textContent = 'Name is required.';
    if (id) Object.assign(p, o); else { const n = { id: uid(), ...o }; S.people.push(n); id = n.id; }
    audit(p.name ? 'Edited' : 'Created', 'person', o.name, '', ''); saveSoon(); d.close(); after ? after(id) : rerender();
  };
  $('[data-del]', d) && ($('[data-del]', d).onclick = async () => {
    const used = S.items.filter(i => i.ownerId === id || (i.coOwnerIds || []).includes(id) || (i.beneficiaryIds || []).includes(id)).length;
    if (used) return toast(`Referenced by ${used} item(s); reassign first.`);
    if (await confirmBox('Delete person', `Delete ${esc(p.name)}?`, 'Delete', true)) { S.people = S.people.filter(x => x.id !== id); audit('Deleted', 'person', p.name, '', ''); saveSoon(); d.close(); rerender(); }
  });
}

VIEWS.valuations = () => {
  const items = activeItems(); const all = items.flatMap(it => itemValuations(it).map(v => ({ ...v, it }))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const outd = items.filter(valuationOutdated);
  return `<h1>Valuations</h1>
  <div class="grid g3"><div class="card kpi"><div class="l">Valuation records</div><div class="v">${all.length}</div></div>
    <div class="card kpi"><div class="l">Outdated or missing</div><div class="v">${outd.length}</div><div class="s">older than ${S.settings.valuationMaxAgeMonths} months (metal items: ${S.settings.metalMaxAgeMonths})</div></div>
    <div class="card kpi"><div class="l">Appraised items</div><div class="v">${items.filter(i => latestOf(i, ['Appraised'])).length}</div></div></div>
  ${outd.length ? `<div class="card" style="margin-top:14px"><h3>Needs a new valuation</h3><div class="tablewrap"><table>${itemTableHead(false)}<tbody>${outd.map(i => itemRow(i)).join('')}</tbody></table></div></div>` : ''}
  <h3 style="margin-top:18px">All valuations</h3>
  <div class="tablewrap"><table><thead><tr><th>Date</th><th>Item</th><th>Type</th><th class="num">Value</th><th class="num">${S.settings.baseCurrency}</th><th>Source</th><th>Valuer</th></tr></thead><tbody>
  ${all.map(v => `<tr class="click" data-act="open-item" data-id="${esc(v.it.id)}" data-tab="valuations"><td>${fmtDate(v.date)}</td><td>${esc(v.it.name)} <span class="mono muted small">${esc(v.it.id)}</span></td><td>${esc(v.type)}</td><td class="num">${money(v.value, v.currency)}</td><td class="num">${moneyBase(fx(v.value, v.currency))}</td><td>${esc(v.source)}</td><td>${esc(v.valuer)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">None</td></tr>'}
  </tbody></table></div>`;
};

VIEWS.insurance = () => {
  const items = activeItems(); const unins = items.filter(i => !itemPolicies(i).length);
  return `<div class="row between"><h1>Insurance analysis</h1><button class="btn pri" data-act="edit-policy">+ Add policy</button></div>
  <p class="muted">Compares the insurance / replacement value of the items each policy covers with its sum insured and its sub-limits. Indicative only — the policy wording and your insurer decide.</p>
  ${S.policies.map(p => { const a = policyAnalysis(p); return `<div class="card" style="margin-bottom:14px"><div class="row between"><div><h2 style="margin:0">${esc(p.insurer)}</h2><div class="muted small">${esc(p.type || '')} · policy ${masked(p.number, 'policy', p.insurer, 'number')} · holder ${esc(personName(p.holderId) || p.holder || '—')}</div></div>
      <div class="row"><span class="pill ${statusClass(a.status)}">${esc(a.status)}</span><button class="btn sm" data-act="edit-policy" data-id="${p.id}">Edit</button><button class="btn sm" data-act="ins-report" data-id="${p.id}">Report</button></div></div>
    <div class="grid g4" style="margin-top:12px"><div class="kpi"><div class="l">Sum insured</div><div class="v">${money(p.coverage, p.currency)}</div><div class="s">deductible ${p.deductible ? money(p.deductible, p.currency) : '—'}</div></div>
      <div class="kpi"><div class="l">Covered items value</div><div class="v">${moneyBase(a.total)}</div><div class="s">${a.items.length} item(s)</div></div>
      <div class="kpi"><div class="l">Cover ratio</div><div class="v">${a.ratio != null ? Math.round(a.ratio * 100) + ' %' : '—'}</div><div class="s">${a.gap > 0 ? 'gap ' + moneyBase(a.gap) : 'no gap'}</div></div>
      <div class="kpi"><div class="l">Renewal</div><div class="v" style="font-size:18px">${fmtDate(p.renewal)}</div><div class="s">${p.renewal ? daysUntil(p.renewal) + ' days' : ''}</div></div></div>
    <div class="row small" style="margin:10px 0">${[['theft', 'Theft / burglary'], ['fire', 'Fire'], ['water', 'Water damage'], ['natural', 'Natural hazards'], ['worldwide', 'Worldwide'], ['lockerCoverage', 'Bank locker contents']].map(([k, l]) => `<span class="pill ${p[k] ? 'ok' : ''}">${p[k] ? '✓' : '✕'} ${l}</span>`).join('')}</div>
    ${a.checks.map(c => `<div class="alert ${c.sev === 'ok' ? '' : c.sev}" style="cursor:default"><span class="n">${c.sev === 'ok' ? '✓' : '!'}</span><span>${esc(c.text)}</span></div>`).join('')}
    ${/household|hausrat/i.test(p.type || '') ? '<p class="small muted">Household-contents policy: the sum insured covers all household contents, not only these valuables, so only sub-limits and under-insurance are meaningful here.</p>' : ''}</div>`; }).join('') || '<div class="card empty">No policy recorded. Add your household contents (Hausrat), valuables or locker insurance.</div>'}
  ${unins.length ? `<div class="card"><h3>Items not covered by any policy (${unins.length}) · ${moneyBase(unins.reduce((a, i) => a + exposure(i), 0))}</h3><div class="tablewrap"><table>${itemTableHead(false)}<tbody>${unins.map(i => itemRow(i)).join('')}</tbody></table></div></div>` : ''}`;
};
function editPolicy(id) {
  const p = id ? policy(id) : { currency: S.settings.baseCurrency, theft: true, fire: true, water: true, type: 'Household contents (Hausrat)', valuablesPct: 20 };
  const num = (k, l, h = '') => `<label class="f">${l}<input type="number" step="any" name="${k}" value="${esc(p[k])}">${h ? `<span class="hint">${h}</span>` : ''}</label>`;
  const chk = (k, l) => `<label class="row small"><input type="checkbox" class="chk" name="${k}" ${p[k] ? 'checked' : ''}> ${l}</label>`;
  const d = modal(id ? 'Edit policy' : 'Add insurance policy', `<form id="polf"><div class="fields">
    <label class="f"><span class="req">Insurance company</span><input name="insurer" value="${esc(p.insurer)}" required></label>
    <label class="f">Policy number (shown masked)<input name="number" value="${esc(p.number)}" autocomplete="off"></label>
    <label class="f">Policy holder${sel('holderId', peopleOpts(), p.holderId)}</label>
    <label class="f">Policy type${sel('type', ['Household contents (Hausrat)', 'Valuables / all-risk (Valoren)', 'Bank locker contents', 'Art / collection', 'Other'], p.type)}</label>
    ${num('coverage', '<span class="req">Sum insured / coverage</span>')}<label class="f">Currency${sel('currency', curOpts(), p.currency)}</label>
    <label class="f">Start date<input type="date" name="start" value="${esc(p.start)}"></label><label class="f">Renewal date<input type="date" name="renewal" value="${esc(p.renewal)}"></label>
    ${num('deductible', 'Deductible / excess')}
    <label class="f">Also covers everything stored at${sel('locationId', locOpts(), p.locationId)}<span class="hint">e.g. a locker policy</span></label></div>
    <h4 style="margin-top:14px">Limits (leave empty if none)</h4><div class="fields">
    ${num('valuablesPct', 'Valuables limit, % of sum insured', 'German Hausrat commonly 20 %')}${num('outsideSafeLimit', 'Valuables outside certified safe', 'e.g. jewellery/gold not locked away')}
    ${num('jewelleryLimit', 'Jewellery / gemstones / watches limit')}${num('goldLimit', 'Gold / bullion / coins limit')}${num('artLimit', 'Art / antiques limit')}${num('itemLimit', 'Per-item limit')}${num('lockerLimit', 'Bank locker contents limit')}</div>
    <h4 style="margin-top:14px">Perils covered</h4><div class="fields">${chk('theft', 'Theft / burglary / robbery')}${chk('fire', 'Fire')}${chk('water', 'Water damage')}${chk('natural', 'Natural hazards (Elementar)')}${chk('worldwide', 'Worldwide / outside home')}${chk('lockerCoverage', 'Bank locker contents')}</div>
    <label class="f" style="margin-top:12px">Documentation requirements (from policy wording)<textarea name="docRequirements" placeholder="e.g. invoices or appraisals required for items over €3,000; photos; list of locker contents">${esc(p.docRequirements)}</textarea></label>
    <div class="err" id="polerr"></div></form>`,
    `${id ? '<button class="btn danger" data-del>Delete</button>' : ''}<button class="btn" data-close>Cancel</button><button class="btn pri" data-save>Save</button>`);
  $('[data-save]', d).onclick = () => {
    const o = formObj($('#polf', d)); if (!o.insurer) return $('#polerr', d).textContent = 'Insurance company is required.';
    if (!o.coverage || isNaN(+o.coverage)) return $('#polerr', d).textContent = 'Enter the sum insured.';
    for (const k of ['coverage', 'deductible', 'valuablesPct', 'outsideSafeLimit', 'jewelleryLimit', 'goldLimit', 'artLimit', 'itemLimit', 'lockerLimit']) o[k] = o[k] === '' ? '' : +o[k];
    if (id) { audit('Edited', 'policy', p.insurer, '', ''); Object.assign(p, o); } else { S.policies.push({ id: uid(), ...o }); audit('Created', 'policy', o.insurer, '', o.type); }
    saveSoon(); d.close(); rerender();
  };
  $('[data-del]', d) && ($('[data-del]', d).onclick = async () => { if (await confirmBox('Delete policy', `Delete ${esc(p.insurer)}? Linked items will show as uninsured.`, 'Delete', true)) { S.policies = S.policies.filter(x => x.id !== id); S.items.forEach(i => { if (i.policyId === id) i.policyId = ''; }); audit('Deleted', 'policy', p.insurer, '', ''); saveSoon(); d.close(); rerender(); } });
}

VIEWS.documents = (p) => {
  const files = S.files.filter(f => { const it = item(f.itemId); return it && !it.deleted; }).filter(f => !p.kind || f.kind === p.kind).sort((a, b) => (b.uploadTs || '').localeCompare(a.uploadTs || ''));
  const total = S.files.reduce((a, f) => a + f.size, 0);
  return `<div class="row between"><h1>Documents & photos</h1><div class="row"><button class="btn sm ${!p.kind ? 'pri' : ''}" data-act="docs-kind" data-kind="">All</button><button class="btn sm ${p.kind === 'doc' ? 'pri' : ''}" data-act="docs-kind" data-kind="doc">Documents</button><button class="btn sm ${p.kind === 'photo' ? 'pri' : ''}" data-act="docs-kind" data-kind="photo">Photos</button></div></div>
  <p class="muted">${S.files.length} encrypted files · ${fmtSize(total)}. Upload new files from an item's Photos or Documents tab.</p>
  <div class="tablewrap"><table><thead><tr><th>Item</th><th>Kind</th><th>Type / view</th><th>File</th><th>Date</th><th>Size</th></tr></thead><tbody>
  ${files.map(f => { const it = item(f.itemId); return `<tr><td><a href="#" data-act="open-item" data-id="${esc(it.id)}">${esc(it.name)}</a> <span class="mono muted small">${esc(it.id)}</span></td><td>${f.kind}</td><td>${esc(f.kind === 'photo' ? f.view : f.docType)}</td><td><a href="#" data-act="open-file" data-id="${f.id}">${esc(f.name)}</a></td><td>${fmtDate(f.kind === 'photo' ? f.photoDate : f.docDate || f.uploadDate)}</td><td>${fmtSize(f.size)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No files.</td></tr>'}
  </tbody></table></div>`;
};

VIEWS.verification = () => `<div class="row between"><h1>Witness & verification</h1><button class="btn pri" data-act="new-verification">+ Record verification</button></div>
  <p class="muted">Have a trusted person (ideally not a beneficiary) confirm the inventory, e.g. when filling or inspecting a locker. Consumer advisers recommend this for locker contents because the bank does not know what is inside.</p>${verTable(S.verifications.slice().reverse())}
  <div class="card" style="margin-top:14px"><h3>Items without any verification (${activeItems().filter(i => !isWitnessed(i)).length})</h3><p class="small muted">${activeItems().filter(i => !isWitnessed(i)).map(i => esc(i.id)).join(', ') || 'None'}</p></div>`;
function newVerification(itemIds = [], locationId = '') {
  if (locationId && !itemIds.length) itemIds = activeItems().filter(i => i.locationId === locationId).map(i => i.id);
  const d = modal('Record verification', `<form id="verf"><div class="fields">
    <label class="f">Verification type${sel('type', SCHEMA.verificationTypes, locationId ? 'Locker inspection witnessed' : 'Inventory witnessed')}</label>
    <label class="f"><span class="req">Witness name</span><input name="witness" required list="peoplelist"><datalist id="peoplelist">${S.people.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist></label>
    <label class="f">Relationship<input name="relationship" placeholder="friend, notary, bank officer…"></label>
    <label class="f"><span class="req">Date witnessed</span><input type="date" name="date" value="${todayISO()}" required></label>
    <label class="f">Place<input name="place"></label><label class="f">Location${sel('locationId', locOpts(), locationId)}</label>
    <label class="f">Identification / reference (optional, masked)<input name="idRef" autocomplete="off"></label>
    <label class="f wide">Items covered<select name="itemIds" multiple size="6">${activeItems().map(i => `<option value="${esc(i.id)}" ${itemIds.includes(i.id) ? 'selected' : ''}>${esc(i.id)} — ${esc(i.name)}</option>`).join('')}</select></label>
    <label class="f wide">Comments<textarea name="comments"></textarea></label></div>
    <label class="f" style="margin-top:10px">Witness signature (draw with finger, pen or mouse)<canvas class="sig" id="sigpad" width="700" height="140"></canvas></label>
    <div class="row"><button class="btn sm" type="button" id="sigclr">Clear signature</button><span class="small muted">You can also print the verification report and sign on paper.</span></div><div class="err" id="vererr"></div></form>`,
    `<button class="btn" data-close>Cancel</button><button class="btn pri" data-save>Save verification</button>`);
  const c = $('#sigpad', d), ctx = c.getContext('2d'); let drawing = false, signed = false;
  ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = e => { drawing = true; signed = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  c.onpointermove = e => { if (drawing) { ctx.lineTo(...pos(e)); ctx.stroke(); } };
  c.onpointerup = () => drawing = false;
  $('#sigclr', d).onclick = () => { ctx.clearRect(0, 0, c.width, c.height); signed = false; };
  $('[data-save]', d).onclick = () => {
    const o = formObj($('#verf', d)); if (!o.witness) return $('#vererr', d).textContent = 'Witness name is required.';
    if (!o.itemIds?.length && !o.locationId) return $('#vererr', d).textContent = 'Select at least one item or a location.';
    const v = { id: uid(), ...o, signature: signed ? c.toDataURL('image/png') : '', recorded: nowISO() };
    S.verifications.push(v); for (const iid of v.itemIds || []) audit('Verification recorded', 'item', iid, '', `${v.type} by ${v.witness}`);
    if (v.locationId && isLocker(loc(v.locationId)) && v.type === 'Locker inspection witnessed') { const L = loc(v.locationId).locker; L.lastInspection = v.date; }
    saveSoon(); d.close(); rerender(); toast('Verification recorded');
  };
}

VIEWS.audit = () => `<div class="row between"><h1>Audit log</h1><button class="btn" data-act="export-audit">Export CSV</button></div>
  <p class="muted">Every create, edit, valuation, owner and location change, upload, reveal, export and backup is recorded. The log is stored inside the encrypted vault.</p>${auditTable(S.audit.slice().reverse())}`;

VIEWS.settings = () => {
  const st = S.settings;
  return `<h1>Settings</h1><form id="setf" class="grid g2">
  <fieldset><legend>General</legend><div class="fields">
    <label class="f">Your name (audit log & reports)<input name="userName" value="${esc(st.userName)}"></label>
    <label class="f">Base currency${sel('baseCurrency', curOpts(), st.baseCurrency)}</label>
    <label class="f">CSV delimiter${sel('csvDelimiter', [[';', 'Semicolon (Excel DE/EU)'], [',', 'Comma (Excel EN)']], st.csvDelimiter)}</label>
    <label class="f">Theme${sel('theme', [['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']], st.theme)}</label></div></fieldset>
  <fieldset><legend>Security</legend><div class="fields">
    <label class="f">Auto-lock after inactivity (minutes)<input type="number" name="autoLockMin" min="1" max="120" value="${st.autoLockMin}"></label>
    <label class="row small"><input type="checkbox" class="chk" name="revealNeedsPassword" ${st.revealNeedsPassword ? 'checked' : ''}> Re-enter password to reveal masked numbers</label></div>
    <div class="row" style="margin-top:10px"><button class="btn" type="button" data-act="change-pw">Change vault password</button></div>
    <p class="small muted">Encryption: AES-256-GCM; key derived with PBKDF2-SHA-256 (${(META?.iter || PBKDF2_ITER).toLocaleString()} iterations). Failed unlocks are throttled after 5 attempts. Biometric unlock, PIN and 2FA are planned for a later version.</p></fieldset>
  <fieldset><legend>Exchange rates → ${esc(st.baseCurrency)}</legend><p class="small muted" style="margin-top:0">1 unit of the currency = x ${esc(st.baseCurrency)}. Enter rates yourself (e.g. from ECB / Nepal Rastra Bank) — the app never fetches them online.</p>
    <div class="fields">${SCHEMA.currencies.filter(c => c !== st.baseCurrency).map(c => `<label class="f">${c}<input type="number" step="any" name="fx.${c}" value="${esc(st.fx[c] ?? '')}"></label>`).join('')}</div>
    <label class="f" style="margin-top:8px">Rates as of<input type="date" name="fxDate" value="${esc(st.fxDate)}"></label></fieldset>
  <fieldset><legend>Alerts & thresholds</legend><div class="fields">
    <label class="f">Valuation outdated after (months)<input type="number" name="valuationMaxAgeMonths" value="${st.valuationMaxAgeMonths}"></label>
    <label class="f">… for gold / metal items (months)<input type="number" name="metalMaxAgeMonths" value="${st.metalMaxAgeMonths}"></label>
    <label class="f">Warn before policy renewal (days)<input type="number" name="renewalWarnDays" value="${st.renewalWarnDays}"></label>
    <label class="f">Appraisal recommended from (${esc(st.baseCurrency)})<input type="number" name="appraisalThreshold" value="${st.appraisalThreshold}"></label>
    <label class="f">Backup reminder after (days)<input type="number" name="backupReminderDays" value="${st.backupReminderDays}"></label></div></fieldset>
  <div style="grid-column:1/-1" class="row"><button class="btn pri" type="submit">Save settings</button></div></form>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Storage & synchronisation</h3><dl class="kv"><dt>Data location</dt><dd>${NATIVE ? `Private app storage of Valuables Vault on this ${Platform.mobile ? 'device' : 'computer'} (${Platform.name}), encrypted` : 'This browser on this device (IndexedDB), encrypted'}</dd><dt>Cloud sync</dt><dd><span class="pill">Off</span> — not available in the prototype; planned as opt-in, end-to-end encrypted</dd>
     <dt>Records</dt><dd>${S.items.length} items · ${S.files.length} files · ${S.audit.length} audit entries</dd><dt>Persistent storage</dt><dd id="persist">checking…</dd><dt>Version</dt><dd>${APP_VERSION}</dd></dl></div>
   <div class="card"><h3>Data</h3><div class="grid"><button class="btn" data-act="load-sample">Load sample data</button><button class="btn" data-act="remove-sample">Remove sample data</button><button class="btn danger" data-act="wipe">Erase vault on this device…</button></div>
   <p class="small muted">Erasing removes all encrypted data from this browser. Make sure you have a verified backup first.</p></div></div>`;
};
AFTER.settings = () => {
  if (NATIVE) { const e = $('#persist'); if (e) e.innerHTML = '<span class="pill ok">app storage — not cleared by browsers</span>'; return bindSettingsForm(); }
  navigator.storage?.persisted?.().then(p => { const e = $('#persist'); if (e) e.innerHTML = p ? '<span class="pill ok">granted</span>' : '<span class="pill warn">not granted</span> <button class="btn sm" data-act="persist">Request</button>'; });
  bindSettingsForm();
};
function bindSettingsForm() {
  $('#setf').onsubmit = e => {
    e.preventDefault(); const o = formObj(e.target); const st = S.settings;
    const fxo = { [o.baseCurrency]: 1 }; for (const [k, v] of Object.entries(o.fx || {})) if (v !== '' && !isNaN(+v) && +v > 0) fxo[k] = +v;
    if (o.baseCurrency !== st.baseCurrency) toast('Base currency changed — re-enter exchange rates relative to the new base.');
    Object.assign(st, { ...o, fx: fxo }); for (const k of ['autoLockMin', 'valuationMaxAgeMonths', 'metalMaxAgeMonths', 'renewalWarnDays', 'appraisalThreshold', 'backupReminderDays']) st[k] = Math.max(0, +st[k] || 0);
    st.autoLockMin = Math.max(1, st.autoLockMin);
    audit('Settings changed', 'settings', '', '', ''); saveSoon(); applyTheme(); toast('Settings saved'); rerender();
  };
};
