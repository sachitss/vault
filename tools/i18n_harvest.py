"""Collect every English string Valuables Vault shows, for translation.

Runs the standalone build in Chromium with window.__I18N_HARVEST set, walks all
screens, item tabs, category forms, dialogs, the import wizard and all reports,
then merges the result with the static extraction (tools/i18n_extract.mjs) to
turn text with numbers or names into {0}-patterns.

Writes tests/out/i18n-strings.json and prints what src/i18n/<lang>.json lack.
Usage:  python3 tools/i18n_harvest.py
"""
import asyncio, json, pathlib, re, subprocess, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'out'; OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'dist' / 'valuables-vault.html').resolve().as_uri()
PW = 'Harvest passphrase 2026!'

STUB = """
window.__I18N_HARVEST = new Set();
window.open = () => ({ closed: false, document: { open(){}, write(){}, close(){} }, focus(){}, print(){} });
"""


async def harvest():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1360, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(STUB)
        await pg.goto(URL)
        await pg.wait_for_selector('#su-name')
        await pg.fill('#su-name', 'Harvest'); await pg.fill('#su-pw', PW); await pg.fill('#su-pw2', PW)
        await pg.click('#setup button[type=submit]')
        await pg.wait_for_selector('#nav', timeout=60000)
        ev = pg.evaluate

        async def close_dialogs():
            await ev("document.querySelectorAll('dialog').forEach(d => { try { d.close() } catch {} })")
            await pg.wait_for_timeout(60)

        async def click_all(sel, view=None, params='{}'):
            n = await ev(f"document.querySelectorAll('{sel}').length")
            for i in range(min(n, 6)):
                if view: await ev(f"go('{view}', {params})"); await pg.wait_for_timeout(60)
                try:
                    await ev(f"document.querySelectorAll('{sel}')[{i}]?.click()")
                    await pg.wait_for_timeout(150)
                except Exception: pass
                await close_dialogs()

        # every screen
        views = await ev("Object.keys(VIEWS)")
        for v in views:
            if v == 'item': continue
            await ev(f"go('{v}')"); await pg.wait_for_timeout(120)
        # items, every tab
        ids = await ev("S.items.map(i => i.id)")
        tabs = await ev("Object.keys(ITEM_TABS)")
        for i in ids:
            for t in tabs:
                await ev(f"go('item', {{id: '{i}', tab: '{t}'}})"); await pg.wait_for_timeout(60)
        # add form for every category
        cats = await ev("Object.keys(SCHEMA.categories)")
        await ev("go('add')")
        for c in cats:
            await pg.select_option('#f_cat', c); await pg.wait_for_timeout(60)
        await pg.click('#itemf button[type=submit]'); await pg.wait_for_timeout(150)   # validation messages
        # dialogs reachable from each screen
        for sel, view, params in [
            ('[data-act=edit-person]', 'people', '{}'), ('[data-act=edit-location]', 'locations', '{}'),
            ('[data-act=edit-policy]', 'insurance', '{}'), ('[data-act=new-verification]', 'verification', '{}'),
            ('[data-act=quick-person]', 'add', '{}'), ('[data-act=change-pw]', 'settings', '{}'),
            ('[data-act=scan]', 'dashboard', '{}'), ('[data-act=wipe]', 'settings', '{}'),
            ('[data-act=remove-sample]', 'settings', '{}'), ('[data-act=delete-item]', 'item', f"{{id: '{ids[0]}'}}"),
            ('[data-act=nav-edit]', 'item', f"{{id: '{ids[0]}'}}"), ('[data-act=reveal]', 'item', f"{{id: '{ids[0]}'}}"),
            ('[data-act=verify-backup]', 'backup', '{}'), ('[data-act=restore]', 'backup', '{}'),
            ('[data-act=inv-bin]', 'inventory', '{}'), ('.alert', 'dashboard', '{}'),
            ('[data-act=docs-kind]', 'documents', '{}'),
        ]:
            await click_all(sel, view, params)
        # reports: capture instead of opening windows
        await ev("window.__REPS = []; openReport = (title, body) => { window.__REPS.push(reportHTML(title, body, true)); }")
        await ev("go('reports')")
        kinds = await ev("[...document.querySelectorAll('[data-act=report]')].map(b => b.dataset.kind)")
        for k in kinds:
            try: await ev(f"buildReport('{k}', activeItems(), {{conf: false, photos: true, allPhotos: true}})")
            except Exception as e: print('report', k, e)
            await pg.wait_for_timeout(200)
        for sel, view, params in [('[data-act=item-report]', 'item', f"{{id: '{ids[0]}'}}"), ('[data-act=locker-report]', 'locations', '{}'),
                                  ('[data-act=ins-report]', 'insurance', '{}'), ('[data-act=ver-report]', 'verification', '{}'),
                                  ('[data-act=qr-labels]', 'inventory', '{}')]:
            await click_all(sel, view, params)
        # import wizard with a messy file
        f = OUT / 'harvest.csv'
        f.write_text('Item name;Category code;Purchase price;Purchase date;Currency;Owner;Foo\n'
                     'Silver tray;ANT;1.250,00;03.04.2019;EUR;Sachit;x\nBad row;XXX;abc;31.02.2019;EURO;;\n', encoding='utf-8')
        await ev("go('import')")
        await pg.set_input_files('#impfile', str(f)); await pg.wait_for_timeout(400)
        await ev("document.querySelector('[data-act=imp-validate]')?.click()"); await pg.wait_for_timeout(300)
        await ev("document.querySelector('[data-act=imp-errors]')?.click()"); await pg.wait_for_timeout(200)
        # backup form validation, settings save
        await ev("go('backup')"); await ev("document.querySelector('#bkf button[type=submit]')?.click()"); await pg.wait_for_timeout(200)
        # lock screens and messages that only exist in code paths
        await ev("renderLock(); renderLock('Locked automatically after inactivity.')")
        await pg.fill('#ul-pw', 'wrong'); await pg.click('#unl button'); await pg.wait_for_timeout(2500)
        await ev("renderSetup()")
        await pg.click('#setup button[type=submit]'); await pg.wait_for_timeout(100)
        data_strings = await ev("""(() => { const o = new Set(); const walk = x => { if (typeof x === 'string') o.add(x.replace(/\\s+/g,' ').trim()); else if (x && typeof x === 'object') Object.values(x).forEach(walk); };
            walk({items: S.items, people: S.people, locations: S.locations, policies: S.policies, valuations: S.valuations, verifications: S.verifications, files: S.files.map(f => ({n: f.name, c: f.caption, r: f.ref}))}); return [...o]; })()""")
        got = await ev("[...window.__I18N_HARVEST]")
        await b.close()
        if errs: print('page errors:', *errs, sep='\n  ')
        return got, set(data_strings)


def generalise(s):
    """Replace numbers, amounts, dates and inventory IDs with {n}."""
    n = [0]
    def rep(_):
        r = '{%d}' % n[0]; n[0] += 1; return r
    tok = r'(?:[A-Z]{3}-\d{4}-\d{5}|(?:[€$]|NPR|EUR|Rs\.?)\s?-?\d[\d.,]*|-?\d[\d.,:/]*(?:\s?(?:€|EUR|NPR|USD|INR|CHF|GBP|%|KB|MB|g|ct|days?))?)'
    return re.sub(tok, rep, s)


def main():
    got, data = asyncio.run(harvest())
    static = json.loads(subprocess.check_output(['node', str(ROOT / 'tools' / 'i18n_extract.mjs')], text=True))
    schema = json.loads((ROOT / 'src' / 'schema.json').read_text(encoding='utf-8'))
    schema_strings = set()
    def walk(x):
        if isinstance(x, str): schema_strings.add(re.sub(r'\s+', ' ', x).strip())
        elif isinstance(x, dict): [walk(v) for v in x.values()]
        elif isinstance(x, list): [walk(v) for v in x]
    walk(schema)
    pats = [(s, re.compile('^' + re.escape(s).replace(r'\{', '{').replace(r'\}', '}').replace('{0}', '(.+?)').replace('{1}', '(.+?)').replace('{2}', '(.+?)').replace('{3}', '(.+?)').replace('{4}', '(.+?)') + '$', re.S))
            for s in static if '{' in s]
    pats.sort(key=lambda p: -len(re.sub(r'\{\d\}', '', p[0])))
    static_exact = {s for s in static if '{' not in s}
    keys = set()
    for h in got:
        if not re.search(r'[A-Za-z]{2}', h): continue
        if h in data and h not in schema_strings and h not in static_exact: continue      # user / sample data
        if h in static_exact or h in schema_strings: keys.add(h); continue
        m = next((p for p, r in pats if r.match(h)), None)
        if m: keys.add(m); continue
        g = generalise(h)
        if re.search(r'[A-Za-z]{2}', re.sub(r'\{\d\}', '', g)): keys.add(g)
    # messages in code that the walk could not trigger (errors, toasts): sentence-like static strings
    for s in static:
        core = re.sub(r'\{\d\}', '', s)
        if re.match(r'^[A-Z{]', s) and re.search(r'[a-z]{2,} [a-z]{2,}', core) and not re.search(r'[#=]|\.js|\.png|https?:|^[A-Z_]+$|\(\)', s) \
                and not any(s in d for d in data):
            keys.add(s)
    # schema labels shown in forms, lists and exports
    for s in schema_strings:
        if re.search(r'[A-Za-z]{2}', s) and not re.match(r'^[A-Z]{3}$', s) and not re.match(r'^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)*$', s):
            keys.add(s)
    keys = sorted(k for k in keys if len(k) < 600)
    (OUT / 'i18n-strings.json').write_text(json.dumps(keys, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(keys)} strings ({sum("{" in k for k in keys)} patterns) -> tests/out/i18n-strings.json')
    for lang in ('de', 'ne'):
        p = ROOT / 'src' / 'i18n' / f'{lang}.json'
        have = json.loads(p.read_text(encoding='utf-8')) if p.exists() else {}
        missing = [k for k in keys if k not in have]
        print(f'{lang}: {len(have)} translated, {len(missing)} missing')
        (OUT / f'i18n-missing-{lang}.json').write_text(json.dumps(missing, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
