"""PWA check: serve dist/pwa on localhost, verify manifest, service worker, offline start."""
import asyncio, functools, http.server, pathlib, socketserver, sys, threading
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PWA = ROOT / 'dist' / 'pwa'


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(PWA))
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://localhost:{httpd.server_address[1]}/'


async def main():
    httpd, url = serve(); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url)
        man = await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
        assert man['name'] == 'Valuables Vault' and len(man['icons']) == 3, man
        ready = await pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)")
        assert ready, 'service worker not active'
        await pg.wait_for_selector('#setup', timeout=60000)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_selector('#setup', timeout=60000)
        print('PWA: manifest ok, service worker active, starts offline')
        await b.close()
    httpd.shutdown()
    if errs:
        print('ERRORS:', errs); sys.exit(1)

asyncio.run(main())
