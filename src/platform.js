/* =====================================================================
   Valuables Vault — platform adapter
   One code base for browsers and the native apps (Tauri shell on Windows,
   macOS, Linux, Android, iOS). In a browser nothing here changes behaviour;
   inside the native shell it routes file saving, printing, external links
   and QR scanning to the operating system.
   ===================================================================== */
const TAURI = window.__TAURI__ || null;
const NATIVE = !!TAURI;
const NATIVE_MOBILE = NATIVE && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const PLATFORM_NAME = !NATIVE ? 'browser' : NATIVE_MOBILE ? (/Android/i.test(navigator.userAgent) ? 'android' : 'ios')
  : /Windows/i.test(navigator.userAgent) ? 'windows' : /Mac/i.test(navigator.userAgent) ? 'macos' : 'linux';

const Platform = {
  native: NATIVE, mobile: NATIVE_MOBILE, name: PLATFORM_NAME,

  /** Save bytes/text under a file name. Native: OS save dialog. Browser: download. Returns false if cancelled. */
  async save(name, data, mime = 'application/octet-stream') {
    if (!NATIVE) return browserDownload(name, data, mime);
    const ext = (name.split('.').pop() || '').toLowerCase();
    const path = await TAURI.dialog.save({ defaultPath: name, filters: ext ? [{ name: ext.toUpperCase() + ' file', extensions: [ext] }] : [] });
    if (!path) return false;
    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer())
      : data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    await TAURI.fs.writeFile(path, bytes);
    if (typeof toast === 'function') toast(`Saved ${name}`);
    return true;
  },

  /** Open a URL (mailto:, https:) outside the app. */
  async openExternal(url) {
    if (NATIVE) return TAURI.opener.openUrl(url);
    window.open(url, '_blank', 'noopener');
  },

  /** Print the current document (desktop). The report overlay calls this while only the report is visible. */
  async print() {
    if (NATIVE && !NATIVE_MOBILE) {
      try { await TAURI.core.invoke('print_page'); return true; } catch (e) { /* fall back */ }
    }
    if (NATIVE_MOBILE) return false;
    window.print(); return true;
  },

  canPrint() { return !NATIVE_MOBILE; },

  /** Scan a QR code with the camera (phones/tablets). Returns the text or null. */
  async scanQR() {
    const bs = TAURI && TAURI.barcodeScanner;
    if (!bs) return null;
    try {
      let perm = await bs.checkPermissions();
      if (perm !== 'granted') perm = await bs.requestPermissions();
      if (perm !== 'granted') throw new Error('Camera permission was not granted.');
      const r = await bs.scan({ windowed: false, formats: ['QR_CODE'] });
      return r && r.content ? r.content : null;
    } catch (e) { if (typeof toast === 'function') toast('Scan cancelled: ' + (e.message || e)); return null; }
  },
  hasCameraScan() { return !!(TAURI && TAURI.barcodeScanner); },
};

function browserDownload(name, data, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mime }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return true;
}

/* In the native shell, links leave the app through the OS, and <a download> links become save dialogs. */
if (NATIVE) {
  document.addEventListener('click', async e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (a.hasAttribute('download') && href && href.startsWith('blob:')) {
      e.preventDefault();
      const blob = await fetch(href).then(r => r.blob());
      await Platform.save(a.getAttribute('download') || 'file', blob, blob.type);
    } else if (/^(mailto:|tel:|https?:)/i.test(href)) {
      e.preventDefault();
      Platform.openExternal(href);
    }
  }, true);
}

/* Report viewer for the native shell: the report is shown in-app, then printed or saved. */
function showReportInApp(title, html) {
  const d = document.createElement('dialog');
  d.className = 'report-viewer';
  d.innerHTML = `<div class="dlg-h"><h2 style="margin:0">${esc(title)}</h2><div class="row">
      ${Platform.canPrint() ? '<button class="btn pri" data-print>Print / Save as PDF</button>' : ''}
      <button class="btn" data-save>Save as HTML</button><button class="btn ghost" data-close aria-label="Close">✕</button></div></div>
    <iframe title="${esc(title)}" sandbox="allow-same-origin allow-modals" style="width:100%;height:calc(100% - 64px);border:0;background:#fff"></iframe>`;
  document.body.appendChild(d); d.showModal();
  const fr = d.querySelector('iframe'); fr.srcdoc = html;
  d.addEventListener('click', e => { if (e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => { clearPrint(); d.remove(); });
  d.querySelector('[data-save]').onclick = () => Platform.save(title.replace(/[^\w.-]+/g, '-').toLowerCase() + '.html', html, 'text/html');
  const pb = d.querySelector('[data-print]');
  if (pb) pb.onclick = () => printHTML(html);
}

/** Print a self-contained HTML report: only #print-root is visible to the printer.
    It stays in the page (hidden on screen) until the viewer closes, because some
    print dialogs render their preview after print() has already returned. */
function clearPrint() { document.getElementById('print-root')?.remove(); document.getElementById('print-style')?.remove(); }
function printHTML(html) {
  clearPrint();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = document.createElement('div'); root.id = 'print-root';
  const style = document.createElement('style'); style.id = 'print-style';
  style.textContent = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n')
    + '\n@media screen{#print-root{display:none}}@media print{body>*:not(#print-root){display:none!important}#print-root{display:block}}';
  root.innerHTML = doc.body.innerHTML;
  root.querySelectorAll('.noprint').forEach(n => n.remove());
  document.head.appendChild(style); document.body.appendChild(root);
  Platform.print();
}
