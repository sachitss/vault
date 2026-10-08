/* =====================================================================
   Valuables Vault — updates and reminder notifications
   Updates: desktop apps install signed updates from GitHub Releases
   (tauri-plugin-updater, verified with the public key in tauri.conf.json);
   phones/tablets, Linux .deb/.rpm and the standalone file show a notice
   with a download link. The web app updates through its service worker.
   Reminders: worked out on this device when the vault is unlocked. Only
   dates and a generic kind (e.g. "renewal") are kept unencrypted so they
   can fire while the vault is locked — never names, insurers or amounts.
   ===================================================================== */
const RELEASES_API = 'https://api.github.com/repos/sachitss/vault/releases/latest';
const RELEASES_PAGE = 'https://github.com/sachitss/vault/releases/latest';
const PREF = { notify: 'vv-notify', autoUpdate: 'vv-autoupdate', reminders: 'vv-reminders', shown: 'vv-reminders-shown', asked: 'vv-notify-asked', lastCheck: 'vv-update-checked', skip: 'vv-update-skip' };
const REMINDER_ID0 = 7100;                       // OS notification ids 7100…7163 belong to reminders

function lsGet(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
const prefOn = k => lsGet(k, '1') === '1';

/* ---------- versions ---------- */
function versionNewer(a, b) {           // is a newer than b?  "0.9.10" > "0.9.9"
  const p = v => String(v || '').replace(/^v/, '').split(/[.-]/).map(x => (/^\d+$/.test(x) ? +x : x));
  const A = p(a), B = p(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0, y = B[i] ?? 0;
    if (typeof x === 'number' && typeof y === 'number') { if (x !== y) return x > y; }
    else if (String(x) !== String(y)) return typeof x === 'number' || String(x) > String(y);
  }
  return false;
}
const IS_PWA = !NATIVE && location.protocol === 'https:' && 'serviceWorker' in navigator;

/* ---------- updates ---------- */
let UPDATE_BUSY = false;
async function checkForUpdate(manual = false) {
  if (UPDATE_BUSY) return;
  if (IS_PWA && !manual) return;                 // the service worker keeps the web app current
  UPDATE_BUSY = true;
  try {
    lsSet(PREF.lastCheck, String(Date.now()));
    if (NATIVE && !NATIVE_MOBILE && TAURI.updater) {
      try {
        const u = await TAURI.updater.check();
        if (!u) { if (manual) toast(tr('Valuables Vault is up to date.')); return; }
        if (!manual && lsGet(PREF.skip) === u.version) return;
        return offerInstall(u);
      } catch (e) {                               // e.g. no network: fall back to the release notice
        window.__updaterError = String(e && e.message || e);
        console.warn('updater', e);
        if (manual) toast(tf('Automatic update not available: {0}', window.__updaterError), 6000);
      }
    }
    const r = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rel = await r.json(); const v = String(rel.tag_name || '').replace(/^v/, '');
    if (!versionNewer(v, APP_VERSION)) { if (manual) toast(tr('Valuables Vault is up to date.')); return; }
    if (!manual && lsGet(PREF.skip) === v) return;
    if (IS_PWA) { navigator.serviceWorker.getRegistration().then(reg => reg?.update()); toast(tf('Version {0} is being loaded. Lock the vault and reload to use it.', v), 8000); return; }
    offerDownload(v, rel.html_url || RELEASES_PAGE);
  } catch (e) {
    if (manual) toast(tf('Could not check for updates: {0}', e.message || e));
  } finally { UPDATE_BUSY = false; }
}

function offerInstall(u) {
  notifyNow(tr('Update available'), tf('Version {0} of Valuables Vault is ready to install.', u.version));
  const notes = esc(u.body || '').slice(0, 1500).replace(/\n/g, '<br>');
  const d = modal(tf('Update to version {0}', u.version),
    `<p>${tf('You have version {0}. The update is signed and verified before it is installed; your encrypted data stays as it is.', APP_VERSION)}</p>
     ${notes ? `<div class="callout small" style="max-height:220px;overflow:auto">${notes}</div>` : ''}
     <div class="small muted" id="upd-progress" style="margin-top:10px"></div>`,
    `<button class="btn ghost" data-upd="skip">${tr('Skip this version')}</button><button class="btn" data-upd="later">${tr('Later')}</button><button class="btn pri" data-upd="install">${tr('Install and restart')}</button>`);
  d.addEventListener('click', async e => {
    const b = e.target.closest('[data-upd]'); if (!b) return;
    if (b.dataset.upd === 'skip') { lsSet(PREF.skip, u.version); d.close(); return; }
    if (b.dataset.upd === 'later') { d.close(); return; }
    d.querySelectorAll('[data-upd]').forEach(x => x.disabled = true);
    const pr = d.querySelector('#upd-progress'); let total = 0, got = 0;
    try {
      if (typeof KEY !== 'undefined' && KEY && S) { await saveNow(); audit('Update installed', 'app', APP_VERSION, APP_VERSION, u.version); await saveNow(); }
      await u.downloadAndInstall(ev => {
        if (ev.event === 'Started') total = ev.data.contentLength || 0;
        if (ev.event === 'Progress') { got += ev.data.chunkLength || 0; pr.textContent = total ? `${tr('Downloading…')} ${Math.round(got / total * 100)} %` : tr('Downloading…'); }
        if (ev.event === 'Finished') pr.textContent = tr('Installing…');
      });
      pr.textContent = tr('Restarting…');
      await TAURI.process.relaunch();
    } catch (err) {
      pr.textContent = tf('The update could not be installed: {0}', err.message || err);
      d.querySelectorAll('[data-upd]').forEach(x => x.disabled = false);
    }
  });
}

function offerDownload(v, url) {
  notifyNow(tr('Update available'), tf('Version {0} of Valuables Vault is available.', v));
  const where = Platform.name === 'android' ? tr('If you installed the app from Google Play, it updates there. Otherwise download the new APK and open it — your data stays.')
    : Platform.name === 'ios' ? tr('Download the new version and install it the same way as before — your data stays.')
    : Platform.name === 'linux' ? tr('Download the new .deb or .rpm package and install it over the current version — your data stays.')
    : tr('Download the new version and install it over the current one — your data stays.');
  const d = modal(tf('Version {0} is available', v), `<p>${tf('You have version {0}.', APP_VERSION)} ${where}</p>`,
    `<button class="btn ghost" data-upd="skip">${tr('Skip this version')}</button><button class="btn" data-upd="later">${tr('Later')}</button><button class="btn pri" data-upd="dl">${tr('Download')}</button>`);
  d.addEventListener('click', e => {
    const b = e.target.closest('[data-upd]'); if (!b) return;
    if (b.dataset.upd === 'skip') lsSet(PREF.skip, v);
    if (b.dataset.upd === 'dl') Platform.openExternal(url);
    d.close();
  });
}

function autoCheckUpdate() {
  if (!prefOn(PREF.autoUpdate)) return;
  const last = +lsGet(PREF.lastCheck, '0');
  if (Date.now() - last < 20 * 3600e3) return;   // at most about once a day
  setTimeout(() => checkForUpdate(false), 4000);
}

/* ---------- reminders ---------- */
const REMINDER_TEXT = {
  renewal: ['Insurance renewal coming up', 'Open Valuables Vault to review your cover before the renewal date.'],
  backup: ['Time for an encrypted backup', 'Make a backup of your vault and keep it in a safe place.'],
  locker: ['Bank locker review due', 'Check the contents of your bank locker and update the inventory.'],
  valuation: ['Valuations are getting old', 'Some valuations are older than your limit — consider updating them.'],
  document: ['A document expires soon', 'Open Valuables Vault to see which document needs renewing.'],
};
function isoDay(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function addDaysISO(iso, n) { const d = new Date(iso.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d); }
function addMonthsISO(iso, n) { const d = new Date(iso.slice(0, 10) + 'T12:00:00'); d.setMonth(d.getMonth() + n); return isoDay(d); }

/** Upcoming reminders from the unlocked vault: [{d: 'YYYY-MM-DD', k: kind}], no personal details. */
function computeReminders() {
  const today = isoDay(new Date()), tomorrow = addDaysISO(today, 1), out = new Map();
  const at = (d, k) => { if (d && /^\d{4}-\d{2}-\d{2}/.test(d)) { d = d.slice(0, 10); if (d >= tomorrow && !out.has(d + k)) out.set(d + k, { d, k }); } };
  const st = S.settings;
  for (const p of S.policies) if (p.renewal) { at(addDaysISO(p.renewal, -st.renewalWarnDays), 'renewal'); at(addDaysISO(p.renewal, -14), 'renewal'); }
  for (const l of S.locations) if (isLocker(l) && l.locker?.nextReview) { at(addDaysISO(l.locker.nextReview, -7), 'locker'); at(l.locker.nextReview, 'locker'); }
  const items = activeItems();
  if (items.length) {
    const lastB = S.backups[S.backups.length - 1];
    const due = lastB ? addDaysISO(lastB.ts, st.backupReminderDays) : tomorrow;
    at(due < tomorrow ? tomorrow : due, 'backup');
  }
  let firstOld = null;
  for (const it of items) {
    const dates = S.valuations.filter(v => v.itemId === it.id && v.date).map(v => v.date).sort();
    const last = dates[dates.length - 1]; if (!last) continue;
    const old = addMonthsISO(last, st.valuationMaxAgeMonths);
    if (old >= tomorrow && (!firstOld || old < firstOld)) firstOld = old;
  }
  at(firstOld, 'valuation');
  for (const it of items) { const exp = it.details?.expiry || it.details?.expiryDate; if (exp) at(addDaysISO(exp, -60), 'document'); }
  return [...out.values()].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 60);
}

async function notifyPermission(request = false) {
  try {
    if (NATIVE && TAURI.notification) {
      if (await TAURI.notification.isPermissionGranted()) return true;
      return request ? (await TAURI.notification.requestPermission()) === 'granted' : false;
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    return request && Notification.permission !== 'denied' ? (await Notification.requestPermission()) === 'granted' : false;
  } catch { return false; }
}
async function notifyNow(title, body) {
  if (!prefOn(PREF.notify) || !(await notifyPermission(false))) return false;
  try {
    if (NATIVE && TAURI.notification) { TAURI.notification.sendNotification({ title, body }); return true; }
    let reg = null;
    try { reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null; } catch { /* file:// has no service worker */ }
    if (reg?.showNotification) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'vault' });
    else new Notification(title, { body });
    return true;
  } catch { return false; }
}

let _remT = null;
/** Recalculate reminders after changes (debounced); phones and tablets get them scheduled in the OS. */
function scheduleReminders() {
  clearTimeout(_remT);
  _remT = setTimeout(async () => {
    if (typeof KEY === 'undefined' || !KEY || !S) return;
    const list = prefOn(PREF.notify) ? computeReminders() : [];
    lsSet(PREF.reminders, JSON.stringify(list));
    if (NATIVE_MOBILE && TAURI.notification) {
      try {
        const ids = Array.from({ length: 64 }, (_, i) => REMINDER_ID0 + i);
        await TAURI.notification.cancel(ids);
        if (!list.length || !(await notifyPermission(false))) return;
        const Sch = TAURI.notification.Schedule;
        list.slice(0, 64).forEach((r, i) => {
          const [title, body] = REMINDER_TEXT[r.k];
          TAURI.notification.sendNotification({ id: REMINDER_ID0 + i, title: tr(title), body: tr(body), schedule: Sch.at(new Date(r.d + 'T10:00:00'), false, true) });
        });
      } catch (e) { console.warn('reminders', e); }
    }
  }, 1500);
}

/** Desktop and browser: show reminders that are due (also while locked). */
async function deliverDueReminders() {
  if (NATIVE_MOBILE || !prefOn(PREF.notify)) return;
  let list = [], shown = [];
  try { list = JSON.parse(lsGet(PREF.reminders, '[]')); shown = JSON.parse(lsGet(PREF.shown, '[]')); } catch { return; }
  const today = isoDay(new Date()), due = list.filter(r => r.d <= today && !shown.includes(r.d + r.k));
  if (!due.length) return;
  const kinds = [...new Set(due.map(r => r.k))];
  for (const k of kinds) { const [t, b] = REMINDER_TEXT[k]; await notifyNow(tr(t), tr(b)); }
  lsSet(PREF.shown, JSON.stringify([...shown, ...due.map(r => r.d + r.k)].slice(-200)));
}

/** First unlock on a phone/tablet/desktop app: ask once for notification permission. */
async function maybeAskNotify() {
  if (!NATIVE || !prefOn(PREF.notify) || lsGet(PREF.asked)) return;
  lsSet(PREF.asked, '1');
  await notifyPermission(true);
  scheduleReminders();
}

function afterUnlock() {
  setTimeout(() => { maybeAskNotify(); scheduleReminders(); deliverDueReminders(); autoCheckUpdate(); }, 1200);
}
function startBackgroundChecks() {
  deliverDueReminders();
  setInterval(deliverDueReminders, 3600e3);
  setInterval(() => { if (typeof KEY !== 'undefined' && KEY) autoCheckUpdate(); }, 6 * 3600e3);
}

/* ---------- settings card ---------- */
function updatesSettingsHTML() {
  const browserNote = !NATIVE ? `<p class="small muted">${tr('In a browser, reminders appear while Valuables Vault is open. The apps for phones, tablets and computers also remind you when the app is closed.')}</p>` : '';
  return `<div class="card" id="upd-card"><h3>${tr('Notifications & updates')}</h3>
    <div class="grid g2">
      <div><label class="row"><input type="checkbox" class="chk" id="pref-notify" ${prefOn(PREF.notify) ? 'checked' : ''}> ${tr('Reminder notifications')}</label>
        <p class="small muted">${tr('Insurance renewals, backups, bank locker reviews, outdated valuations and expiring documents. Notifications never show names, insurers or amounts.')}</p>
        ${browserNote}
        <div class="row"><button class="btn sm" type="button" data-upd-act="perm">${tr('Allow notifications')}</button><button class="btn sm" type="button" data-upd-act="test">${tr('Send test notification')}</button><span class="small muted" id="perm-state"></span></div></div>
      <div><label class="row"><input type="checkbox" class="chk" id="pref-autoupdate" ${prefOn(PREF.autoUpdate) ? 'checked' : ''}> ${tr('Check for updates automatically')}</label>
        <p class="small muted">${tf('Installed version: {0}.', APP_VERSION)} ${tr('The check asks GitHub for the latest version number; no vault data is sent.')}</p>
        <div class="row"><button class="btn sm" type="button" data-upd-act="check">${tr('Check for updates now')}</button></div></div>
    </div></div>`;
}
async function bindUpdatesSettings() {
  const card = $('#upd-card'); if (!card) return;
  const showPerm = async () => { const ok = await notifyPermission(false); const s = $('#perm-state'); if (s) s.textContent = ok ? tr('Notifications allowed') : tr('Notifications not allowed yet'); };
  showPerm();
  $('#pref-notify').onchange = e => { lsSet(PREF.notify, e.target.checked ? '1' : '0'); scheduleReminders(); };
  $('#pref-autoupdate').onchange = e => lsSet(PREF.autoUpdate, e.target.checked ? '1' : '0');
  card.addEventListener('click', async e => {
    const a = e.target.closest('[data-upd-act]')?.dataset.updAct; if (!a) return;
    if (a === 'perm') { await notifyPermission(true); showPerm(); scheduleReminders(); }
    if (a === 'test') { const ok = await notifyNow(tr('Valuables Vault'), tr('Notifications are working.')); if (!ok) toast(tr('Notifications are off or not allowed.')); }
    if (a === 'check') checkForUpdate(true);
  });
}
