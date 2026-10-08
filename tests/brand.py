import pathlib, os
ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = os.environ.get('VAULT_HTML', str(ROOT/'dist'/'valuables-vault.html'))
URL_ = pathlib.Path(HTML).resolve().as_uri()
OUT_ = str(ROOT/'tests'/'out'); os.makedirs(OUT_, exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
PW='Correct horse battery staple 42!'; O=OUT_
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for scheme in ['light','dark']:
      ctx=await b.new_context(viewport={'width':1360,'height':900},color_scheme=scheme); pg=await ctx.new_page()
      await pg.goto(URL_); await pg.wait_for_timeout(300)
      await pg.screenshot(path=f'{O}/b-setup-{scheme}.png')
      await pg.fill('#su-name','Sachit Shrestha'); await pg.fill('#su-pw',PW); await pg.fill('#su-pw2',PW); await pg.click('button[type=submit]'); await pg.wait_for_selector('#nav',timeout=60000)
      await pg.evaluate("go('insurance')"); await pg.wait_for_timeout(300)
      await pg.screenshot(path=f'{O}/b-app-{scheme}.png', full_page=True)
      if scheme=='light':
        img=await pg.evaluate("(()=>{const i=document.querySelector('.brandchip img');return [i.naturalWidth,i.naturalHeight,i.clientWidth,i.clientHeight]})()"); print('logo natural/display',img, 'ratio', img[0]/img[1], img[2]/img[3])
        await pg.evaluate("go('reports')")
        async with pg.expect_popup() as pop: await pg.click('[data-act=report][data-kind=locker]')
        w=await pop.value; await w.wait_for_function("document.querySelector('.rbrand')"); await w.screenshot(path=f'{O}/b-report.png', full_page=True); await w.close()
        await pg.set_viewport_size({'width':390,'height':844}); await pg.evaluate("go('dashboard')"); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{O}/b-mobile.png', full_page=True)
        await pg.click('[data-act=lock]'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{O}/b-lock-mobile.png')
      await ctx.close()
    await b.close()
asyncio.run(main())
