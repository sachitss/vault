import pathlib, os
ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = os.environ.get('VAULT_HTML', str(ROOT/'dist'/'valuables-vault.html'))
URL_ = pathlib.Path(HTML).resolve().as_uri()
OUT_ = str(ROOT/'tests'/'out'); os.makedirs(OUT_, exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
O=OUT_
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for vp,n in [({'width':1360,'height':900},'d'),({'width':390,'height':844},'m')]:
      pg=await b.new_page(viewport=vp); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto(URL_, wait_until='commit')
      await pg.wait_for_selector('#splash', timeout=10000)
      for i,t in enumerate([150,700,1000]):
        await pg.wait_for_timeout(t); await pg.screenshot(path=f'{O}/s-{n}{i}.png')
      await pg.wait_for_timeout(1500)
      print(n,'splash gone:', await pg.evaluate("!document.getElementById('splash')"), 'setup shown:', await pg.evaluate("!!document.getElementById('setup')"), errs)
      assert not errs and await pg.evaluate("!document.getElementById('splash') && !!document.getElementById('setup')")
      await pg.close()
    await b.close()
asyncio.run(main())
