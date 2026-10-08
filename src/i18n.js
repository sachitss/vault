/* =====================================================================
   Valuables Vault — languages: English, Deutsch, नेपाली
   The app is written in English. This layer translates what is shown —
   screens, dialogs, messages, reports — from the dictionaries in
   src/i18n/<lang>.json, which the build embeds as window.__I18N.
   Keys are the English text (whitespace-normalised); keys containing
   {0}, {1}… are patterns whose parts are translated in turn.
   User data in form fields is never touched. Elements marked
   translate="no" (and their children) are left as they are.
   ===================================================================== */
const LANGS = { en: 'English', de: 'Deutsch', ne: 'नेपाली' };
const LOCALES = { en: 'en-IE', de: 'de-DE', ne: 'ne-NP-u-nu-latn' };
const LANG_KEY = 'vv-lang';

function detectLang() {
  try { const s = localStorage.getItem(LANG_KEY); if (s && LANGS[s]) return s; } catch { /* storage blocked */ }
  for (const l of (navigator.languages || [navigator.language || 'en']).map(x => String(x).toLowerCase())) {
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('ne')) return 'ne';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}
function langChosen() { try { return !!localStorage.getItem(LANG_KEY); } catch { return false; } }

let LANG = detectLang();
let LOCALE = LOCALES[LANG];
let DICT = null;

function i18nNorm(s) { return s.replace(/\s+/g, ' ').trim(); }
function buildDict(lang) {
  const src = (window.__I18N || {})[lang];
  if (!src || lang === 'en') return null;
  const exact = new Map(), pats = [];
  for (const [k, v] of Object.entries(src)) {
    if (!v || k.startsWith('//')) continue;
    if (/\{\d\}/.test(k)) {
      // short patterns that start with a placeholder ("{0} open", "{0} days") only match numbers,
      // so free text such as "… cleared by browsers" is never half-translated
      const lit = k.replace(/\{\d\}/g, '').replace(/[\s·,:;()—–/-]/g, '');
      const ph = k.startsWith('{') && lit.length < 7 ? '(\\d[\\d.,]*)' : '(.+?)';
      const re = new RegExp('^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d)\\\}/g, ph) + '$', 's');
      pats.push([re, v, k.replace(/\{\d\}/g, '').length]);
    } else exact.set(i18nNorm(k), v);
  }
  pats.sort((a, b) => b[2] - a[2]);                 // most specific pattern first
  return { exact, pats };
}
DICT = buildDict(LANG);

/** Translate one English string (or return it unchanged). */
function tr(s) {
  if (s == null) return s;
  s = String(s);
  const k = i18nNorm(s);
  if (!k) return s;
  if (window.__I18N_HARVEST) window.__I18N_HARVEST.add(k);
  if (!DICT) return s;
  let t = DICT.exact.get(k);
  if (t === undefined) {
    for (const [re, out] of DICT.pats) {
      const m = re.exec(k);
      if (m) { t = out.replace(/\{(\d)\}/g, (_, i) => { const p = m[+i + 1] ?? ''; const x = DICT.exact.get(i18nNorm(p)); return x === undefined ? p : x; }); break; }
    }
  }
  if (t === undefined) {                           // lists such as "Owner, Locker holder"
    for (const sep of [' · ', ', ', '; ', ' / ']) {
      const parts = k.split(sep);
      if (parts.length > 1 && parts.some(p => DICT.exact.has(p)) && parts.every(p => DICT.exact.has(p) || !/\p{L}{2}/u.test(p))) { t = parts.map(p => DICT.exact.get(p) ?? p).join(sep); break; }
    }
  }
  if (t === undefined) {                           // "Name (type)" — translate the known type in brackets
    const m = /^(.*) \(([^()]+)\)$/s.exec(k);
    if (m && DICT.exact.has(m[2])) t = `${tr(m[1])} (${DICT.exact.get(m[2])})`;
    else if (m && /^([A-Z]{3}|[A-Z]{2}|[\d%‰.,\s]+)$/.test(m[2]) && DICT.exact.has(m[1])) t = `${DICT.exact.get(m[1])} (${m[2]})`;
  }
  if (t === undefined) {                           // "Group: Field" (export column names)
    const i = k.indexOf(': ');
    if (i > 0 && DICT.exact.has(k.slice(0, i)) && tr(k.slice(i + 2)) !== k.slice(i + 2)) t = `${DICT.exact.get(k.slice(0, i))}: ${tr(k.slice(i + 2))}`;
  }
  if (t === undefined) return s;
  return s.match(/^\s*/)[0] + t + s.match(/\s*$/)[0];
}
/** Template helper for code: tf('Renewal due in {0} days', d) */
function tf(s, ...args) { const out = tr(s); return args.length ? out.replace(/\{(\d)\}/g, (_, i) => args[+i] ?? '') : out; }

/* ---------- DOM translation ---------- */
const TR_ATTRS = ['placeholder', 'title', 'aria-label'];
const TR_SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);
const ORIG = new WeakMap(), SET = new WeakMap();

function skipEl(el) { return !el || TR_SKIP.has(el.nodeName) || (el.closest && el.closest('[translate="no"],.mono,.mask')); }
function trText(n) {
  const cur = n.nodeValue;
  let orig = ORIG.get(n);
  if (orig === undefined || (SET.get(n) !== cur && cur !== orig)) { orig = cur; ORIG.set(n, orig); }
  const out = tr(orig);
  if (out !== cur) { n.nodeValue = out; }
  SET.set(n, out);
}
function trAttrs(el) {
  for (const a of TR_ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const key = 'data-en-' + a, cur = el.getAttribute(a);
    let orig = el.getAttribute(key);
    if (orig === null || (cur !== orig && cur !== tr(orig))) { orig = cur; el.setAttribute(key, orig); }
    const out = tr(orig); if (out !== cur) el.setAttribute(a, out);
  }
  if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) {
    const orig = el.getAttribute('data-en-value') ?? el.value; el.setAttribute('data-en-value', orig); el.value = tr(orig);
  }
}
/** Translate everything under root (an element or document). */
function trDOM(root) {
  if (!root) return;
  const doc = root.ownerDocument || root;
  if (root.nodeType === 3) { if (!skipEl(root.parentElement)) trText(root); return; }
  if (root.nodeType === 1 && skipEl(root)) return;
  if (root.nodeType === 1) trAttrs(root);
  const w = doc.createTreeWalker(root, 1 | 4, { acceptNode: n => (n.nodeType === 1 ? (skipEl(n) ? 2 : 1) : (n.nodeValue.trim() ? 1 : 3)) });
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
}
/** Translate a whole HTML document given as a string (reports, exports). */
function trHTML(html) {
  if (LANG === 'en' && !window.__I18N_HARVEST) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.documentElement.lang = LANG;
  trDOM(doc.head); trDOM(doc.body);
  return (/^\s*<!doctype/i.test(html) ? '<!doctype html>\n' : '') + doc.documentElement.outerHTML;
}

let _obs = null;
function startI18n() {
  document.documentElement.lang = LANG;
  document.documentElement.dataset.lang = LANG;
  if (_obs || (LANG === 'en' && !window.__I18N_HARVEST)) return;
  trDOM(document.body);
  _obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(n => (n.nodeType === 1 || n.nodeType === 3) && trDOM(n));
      else if (m.type === 'characterData') { if (!skipEl(m.target.parentElement) && SET.get(m.target) !== m.target.nodeValue) trText(m.target); }
      else if (m.type === 'attributes' && !m.attributeName.startsWith('data-en-')) { if (!skipEl(m.target)) trAttrs(m.target); }
    }
  });
  _obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...TR_ATTRS, 'value'] });
}

/** Switch language. Screens are re-rendered so numbers and dates use the new format too. */
function setLang(l) {
  if (!LANGS[l]) return;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked: applies to this session */ }
  LANG = l; LOCALE = LOCALES[l]; DICT = buildDict(l);
  document.documentElement.lang = l; document.documentElement.dataset.lang = l;
  if (!_obs) startI18n();
  // retranslate what is on screen from the stored English originals
  const w = document.createTreeWalker(document.body, 4); let n;
  while ((n = w.nextNode())) { const o = ORIG.get(n); if (o !== undefined && !skipEl(n.parentElement)) { const out = tr(o); n.nodeValue = out; SET.set(n, out); } }
  document.querySelectorAll('[data-en-placeholder],[data-en-title],[data-en-aria-label],[data-en-value]').forEach(trAttrs);
  trDOM(document.body);
  if (typeof onLangChange === 'function') onLangChange();
}

/** Language picker (lock screens, settings). */
function langPickerHTML(cls = '') {
  return `<div class="langpick ${cls}" role="group" aria-label="Language" translate="no">${Object.entries(LANGS).map(([k, v]) =>
    `<button type="button" class="${k === LANG ? 'on' : ''}" data-lang="${k}" lang="${k}">${v}</button>`).join('')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.langpick [data-lang]');
  if (!b) return;
  setLang(b.dataset.lang);
  document.querySelectorAll('.langpick [data-lang]').forEach(x => x.classList.toggle('on', x.dataset.lang === LANG));
});

/* ---------- import: accept column names and labels in any language ---------- */
const i18nKey = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** Does `text` equal the English `label` or its German/Nepali translation? */
function sameInAnyLang(text, label) {
  const k = i18nKey(text); if (!k) return false;
  if (k === i18nKey(label)) return true;
  const all = window.__I18N || {}, n = i18nNorm(String(label || ''));
  return Object.values(all).some(d => d[n] && i18nKey(d[n]) === k);
}

/* ---------- Excel export in the chosen language ---------- */
const XL_FREE_TEXT = /^(item|inventory id|name|description|notes?|address|source|valuer|file name|owner|co-owners|beneficiaries|user|previous value|new value|holder|insurer|location|bank|branch|ref|field|policy no\.|locker no\.|serial.*|.*number.*|title|artist|maker|brand|model|reference|witness|place)$/i;
function trWorkbook(wb) {
  if (LANG === 'en') return;
  for (const ws of wb.worksheets) {
    const heads = [];
    ws.getRow(1).eachCell((c, i) => { heads[i] = String(c.value ?? ''); });
    const overview = ws.name === 'Inventory Overview';
    ws.eachRow((row, n) => row.eachCell((c, i) => {
      if (typeof c.value !== 'string' || !c.value) return;
      if (overview || n === 1) { c.value = tr(c.value); return; }
      if (XL_FREE_TEXT.test(heads[i] || '')) return;
      c.value = c.value.split('; ').map(x => tr(x)).join('; ');
    }));
    ws.name = tr(ws.name).replace(/[*?:\\/\[\]]/g, '-').slice(0, 31);
  }
}
