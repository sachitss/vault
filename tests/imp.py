import pathlib, os
ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = os.environ.get('VAULT_HTML', str(ROOT/'dist'/'valuables-vault.html'))
URL_ = pathlib.Path(HTML).resolve().as_uri()
OUT_ = str(ROOT/'tests'/'out'); os.makedirs(OUT_, exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
PW='Correct horse battery staple 42!'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(URL_)
    await pg.fill('#su-name','T'); await pg.fill('#su-pw',PW); await pg.fill('#su-pw2',PW); await pg.uncheck('#su-sample'); await pg.click('button[type=submit]'); await pg.wait_for_selector('#nav',timeout=60000)
    for f in [str(ROOT/'templates'/'valuables-import-template.xlsx'),str(ROOT/'templates'/'sample-inventory.csv')]:
      await pg.evaluate("go('import')"); await pg.set_input_files('#impfile',f); await pg.wait_for_timeout(600)
      print(os.path.basename(f), await pg.text_content('#impwiz .muted.small'))
      await pg.select_option('#dupmode','update'); await pg.click('[data-act=imp-validate]'); await pg.wait_for_timeout(300)
      print(' ', await pg.eval_on_selector_all('#imppreview .pill','e=>e.slice(0,5).map(x=>x.textContent)'))
      await pg.click('[data-act=imp-run]'); await pg.wait_for_timeout(500)
    print(await pg.evaluate("S.items.map(i=>[i.id,i.purchaseDate||i.acquiredDate,i.purchasePrice,i.currency,personName(i.ownerId),locName(i.locationId),JSON.stringify(i.details)].join(' | ')).join('\\n')"))
    print('valuations',await pg.evaluate("S.valuations.map(v=>v.itemId+' '+v.type+' '+v.value+' '+v.date).join('; ')"))
    print('JWL score', await pg.evaluate("itemScore(item('JWL-2026-00001')).score"), 'errors', errs)
    assert not errs, errs
    assert await pg.evaluate("S.items.length")==5, 'expected 5 imported items'
    await b.close()
asyncio.run(main())
