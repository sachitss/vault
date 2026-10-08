"""Build Valuables Vault.

Outputs
  dist/valuables-vault.html   standalone single file (desktop installers, double-click use)
  dist/pwa/                   installable web app for GitHub Pages / any HTTPS host
                              (index.html, manifest.webmanifest, sw.js, icons/, privacy.html)

The build is deterministic: the same sources and library versions give
byte-identical output, which CI uses to check that the committed
dist/valuables-vault.html is up to date.

Usage:  npm ci && python3 tools/build.py
"""
import base64, hashlib, json, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC, ASSETS, DIST = ROOT / 'src', ROOT / 'assets', ROOT / 'dist'
NM = ROOT / 'node_modules'
APP_FILES = ['platform.js', 'core.js', 'ui.js', 'views2.js', 'data.js']
LIBS = ['xlsx/dist/xlsx.full.min.js', 'exceljs/dist/exceljs.min.js', 'qrcode-generator/dist/qrcode.js']

CSP_STANDALONE = ("default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; "
                  "img-src data: blob:; frame-src blob:; media-src blob: mediastream:; connect-src blob: data:; worker-src blob:")
CSP_PWA = ("default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; "
           "img-src 'self' data: blob:; frame-src blob:; media-src blob: mediastream:; connect-src 'self' blob: data:; "
           "worker-src 'self' blob:; manifest-src 'self'")


def read(p): return pathlib.Path(p).read_text(encoding='utf-8')
def b64(p): return base64.b64encode(pathlib.Path(p).read_bytes()).decode()
def safe(js): return js.replace('</script', '<\\/script')


def page(version: str, mode: str) -> str:
    """mode: 'standalone' (single file), 'pwa' (installable web app) or 'native' (Tauri shell)."""
    pwa = mode == 'pwa'
    missing = [l for l in LIBS if not (NM / l).exists()]
    if missing:
        sys.exit(f'Missing libraries {missing} — run "npm ci" first.')
    schema = json.loads(read(SRC / 'schema.json'))
    logo = 'data:image/png;base64,' + b64(ASSETS / 'brand-logo.png')
    samples = {k: b64(ROOT / 'samples' / f'{k}.pdf') for k in ['invoice', 'cert', 'appraisal']}
    app = ''.join(read(SRC / f) for f in APP_FILES)
    app = app.replace("const APP_VERSION = '0.9.0-prototype';", f"const APP_VERSION = '{version}';")
    if "const APP_VERSION = '" + version + "';" not in app:
        sys.exit('APP_VERSION constant not found in src/core.js')
    head_extra = ''
    if pwa:
        head_extra = ('<link rel="manifest" href="manifest.webmanifest">\n'
                      '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
                      '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                      '<meta name="mobile-web-app-capable" content="yes">\n'
                      '<meta name="apple-mobile-web-app-title" content="Vault">\n'
                      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n')
        favicon = '<link rel="icon" href="icons/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="icons/icon-192.png">'
    else:
        favicon = '<link rel="icon" type="image/png" href="data:image/png;base64,' + b64(ASSETS / 'icons' / 'icon-32.png') + '">'
    sw = ''
    if pwa:
        sw = ("<script>if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){"
              "navigator.serviceWorker.register('sw.js').then(r=>{r.addEventListener('updatefound',()=>{const w=r.installing;"
              "w&&w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller&&typeof toast==='function')"
              "toast('An update is installed. Lock the vault and reload to use it.',8000)})})}).catch(()=>{})}</script>\n")
    splash = read(SRC / 'splash.html').replace('__LOGO__', logo)
    return (f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{'' if mode == 'native' else f'<meta http-equiv="Content-Security-Policy" content="{CSP_PWA if pwa else CSP_STANDALONE}">'}
<meta name="referrer" content="no-referrer"><meta name="theme-color" content="#16263d">
<meta name="application-name" content="Valuables Vault"><meta name="author" content="Ing.-Büro Sachit Shrestha">
<meta name="generator" content="Valuables Vault {version}">
<title>Valuables Vault</title>
{favicon}
{head_extra}<style>{read(SRC / 'app.css')}</style></head><body>
{splash}
<noscript>JavaScript is required.</noscript>
<script>window.__SCHEMA={json.dumps(schema)};window.__SAMPLE_FILES={json.dumps(samples)};window.__BRAND_LOGO={json.dumps(logo)};</script>
''' + ''.join(f'<script>{safe(read(NM / l))}</script>\n' for l in LIBS)
            + f'<script>{safe(app)}</script>\n{sw}</body></html>\n')


def build_pwa(version: str, html: str):
    out = DIST / 'pwa'
    if out.exists():
        shutil.rmtree(out)
    (out / 'icons').mkdir(parents=True)
    (out / 'index.html').write_text(html, encoding='utf-8')
    icons = ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']
    for i in icons:
        shutil.copy(ASSETS / 'icons' / i, out / 'icons' / i)
    manifest = {
        'name': 'Valuables Vault', 'short_name': 'Vault', 'id': './', 'start_url': './', 'scope': './',
        'display': 'standalone', 'orientation': 'any', 'background_color': '#16263d', 'theme_color': '#16263d',
        'description': 'Secure, offline inventory for valuables, safes and bank lockers.',
        'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                  {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
        'categories': ['finance', 'productivity'],
    }
    (out / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    files = ['./', 'index.html', 'manifest.webmanifest'] + [f'icons/{i}' for i in icons]
    digest = hashlib.sha256(html.encode()).hexdigest()[:12]
    sw = f"""/* Valuables Vault service worker — caches the app shell only. Vault data never passes through here:
   it is encrypted in IndexedDB and is never sent over the network. */
const CACHE = 'valuables-vault-{version}-{digest}';
const FILES = {json.dumps(files)};
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {{ e.respondWith(caches.match('index.html').then(c => c || fetch(r))); return; }}
  e.respondWith(caches.match(r).then(c => c || fetch(r)));
}});
"""
    (out / 'sw.js').write_text(sw, encoding='utf-8')
    shutil.copy(SRC / 'privacy.html', out / 'privacy.html')   # privacy policy (app stores link to it)
    (out / '.nojekyll').write_text('')


def main():
    version = json.loads(read(ROOT / 'package.json'))['version']
    DIST.mkdir(exist_ok=True)
    standalone = page(version, 'standalone')
    (DIST / 'valuables-vault.html').write_text(standalone, encoding='utf-8')
    build_pwa(version, page(version, 'pwa'))
    app = DIST / 'app'                       # frontend for the Tauri shell (CSP is set in src-tauri/tauri.conf.json)
    app.mkdir(exist_ok=True)
    (app / 'index.html').write_text(page(version, 'native'), encoding='utf-8')
    print(f'Valuables Vault {version}: dist/valuables-vault.html ({len(standalone) // 1024} KB), dist/pwa/, dist/app/')


if __name__ == '__main__':
    main()
