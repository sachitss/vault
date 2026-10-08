"""Updates and reminder notifications (browser build; the native plugins are covered by the native smoke test).

- version comparison
- reminders hold only dates and kinds — no names, insurers or amounts — and stay readable while locked
- due reminders are shown once, in the chosen language
- update check: newer release -> notice with download; same/older -> "up to date"; GitHub API mocked
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / 'dist' / 'valuables-vault.html').resolve().as_uri()
PW = 'Updates test passphrase 1!'
fail = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fail.append(msg)

NOTIFY_SPY = """
window.__notes = [];
window.Notification = class { constructor(t, o) { window.__notes.push([t, (o || {}).body]); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(locale='en-US')
        await ctx.add_init_script(NOTIFY_SPY)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        release = {'tag_name': 'v9.9.9', 'html_url': 'https://github.com/sachitss/vault/releases/tag/v9.9.9'}
        async def api(route): await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(release))
        await pg.route('https://api.github.com/**', api)
        await pg.goto(URL); await pg.wait_for_selector('#su-name')
        cases = await pg.evaluate("[versionNewer('0.9.10','0.9.9'), versionNewer('0.9.1','0.9.1'), versionNewer('1.0.0','0.9.9'), versionNewer('0.9.0','0.9.1'), versionNewer('v0.10.0','0.9.1')]")
        check(cases == [True, False, True, False, True], f'version comparison {cases}')
        await pg.fill('#su-name', 'Test'); await pg.fill('#su-pw', PW); await pg.fill('#su-pw2', PW)
        await pg.click('#setup button[type=submit]'); await pg.wait_for_selector('#nav', timeout=60000)
        await pg.wait_for_timeout(3500)                     # afterUnlock + debounced scheduling
        rem = await pg.evaluate("localStorage.getItem('vv-reminders')")
        lst = json.loads(rem or '[]')
        check(len(lst) > 0 and all(set(r) == {'d', 'k'} for r in lst), f'reminders stored as date + kind only ({len(lst)}: {sorted({r["k"] for r in lst})})')
        secret_words = await pg.evaluate("[...S.policies.map(p => p.insurer), ...S.items.map(i => i.name), ...S.people.map(p => p.name), ...S.locations.map(l => l.name)]")
        check(not any(w and w in rem for w in secret_words), 'no insurer, item, person or location names in the unencrypted reminder list')
        # due reminder shown once (also while locked), in German
        await pg.evaluate("localStorage.setItem('vv-reminders', JSON.stringify([{d:'2020-01-01',k:'backup'},{d:'2099-01-01',k:'renewal'}])); localStorage.removeItem('vv-reminders-shown'); setLang('de'); lockVault(); renderLock();")
        await pg.evaluate("deliverDueReminders()"); await pg.wait_for_timeout(300)
        notes = await pg.evaluate("window.__notes")
        check(len(notes) == 1 and 'Sicherung' in notes[0][0], f'due reminder shown in German while locked {notes}')
        await pg.evaluate("deliverDueReminders()"); await pg.wait_for_timeout(200)
        check(len(await pg.evaluate("window.__notes")) == 1, 'reminder not repeated')
        # update notice (unlock again in English)
        await pg.evaluate("setLang('en')")
        await pg.fill('#ul-pw', PW); await pg.click('#unl button'); await pg.wait_for_selector('#nav', timeout=60000)
        await pg.evaluate("checkForUpdate(true)"); await pg.wait_for_timeout(800)
        dlg = await pg.evaluate("[...document.querySelectorAll('dialog[open]')].map(d => d.textContent).join(' ')")
        check('9.9.9' in dlg and 'Download' in dlg, 'newer release offered with a download button')
        await pg.evaluate("document.querySelectorAll('dialog').forEach(d => d.close())")
        release['tag_name'] = 'v0.0.1'
        await pg.evaluate("checkForUpdate(true)"); await pg.wait_for_timeout(800)
        toasts = await pg.evaluate("[...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ')")
        check('up to date' in toasts, f'older release -> up to date ({toasts})')
        # settings card
        await pg.evaluate("go('settings')")
        check(await pg.locator('#upd-card').count() == 1, 'settings card for notifications and updates')
        await pg.uncheck('#pref-autoupdate')
        check(await pg.evaluate("localStorage.getItem('vv-autoupdate')") == '0', 'auto-update setting saved')
        check(not errs, f'no page errors {errs[:2]}')
        await b.close()

asyncio.run(main())
print('\nAll update checks passed.' if not fail else f'\n{len(fail)} update checks FAILED')
sys.exit(1 if fail else 0)
