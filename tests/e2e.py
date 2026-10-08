import pathlib, os
ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = os.environ.get('VAULT_HTML', str(ROOT/'dist'/'valuables-vault.html'))
URL_ = pathlib.Path(HTML).resolve().as_uri()
OUT_ = str(ROOT/'tests'/'out'); os.makedirs(OUT_, exist_ok=True)
import asyncio, os, sys, json
from playwright.async_api import async_playwright
URL=URL_; OUT=OUT_; os.makedirs(OUT,exist_ok=True)
PW='Correct horse battery staple 42!'
errs=[]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True, viewport={'width':1360,'height':900})
    pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: m.type=='error' and errs.append('CONSOLE '+m.text))
    await pg.goto(URL)
    await pg.fill('#su-name','Sachit Shrestha'); await pg.fill('#su-pw',PW); await pg.fill('#su-pw2',PW)
    await pg.click('button[type=submit]')
    await pg.wait_for_selector('#nav', timeout=60000)
    await pg.wait_for_timeout(800); await pg.screenshot(path=f'{OUT}/01-dashboard.png', full_page=True)
    kpis=await pg.eval_on_selector_all('.kpi .v','e=>e.map(x=>x.textContent)'); print('KPIs',kpis)
    alerts=await pg.eval_on_selector_all('.alert','e=>e.map(x=>x.textContent.trim().replace(/\\s+/g," "))'); print('ALERTS',*alerts,sep='\n  ')
    # item page
    await pg.evaluate("go('item',{id:'JWL-2026-00001'})"); await pg.wait_for_timeout(300)
    print('SCORE JWL', await pg.evaluate("itemScore(item('JWL-2026-00001')).score"), await pg.evaluate("itemScore(item('JWL-2026-00001')).missing"))
    await pg.screenshot(path=f'{OUT}/02-item.png', full_page=True)
    for t in ['valuations','photos','documents','verification','history']:
      await pg.evaluate(f"go('item',{{id:'JWL-2026-00001',tab:'{t}'}})"); await pg.wait_for_timeout(150)
    await pg.evaluate("go('item',{id:'JWL-2026-00001',tab:'valuations'})"); await pg.screenshot(path=f'{OUT}/03-valuations.png', full_page=True)
    await pg.evaluate("go('item',{id:'JWL-2026-00001',tab:'photos'})"); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{OUT}/04-photos.png', full_page=True)
    for v in ['inventory','add','locations','people','valuations','insurance','documents','verification','reports','import','backup','settings','audit']:
      await pg.evaluate(f"go('{v}')"); await pg.wait_for_timeout(150)
      if v in ('insurance','locations','inventory','add','import'): await pg.screenshot(path=f'{OUT}/v-{v}.png', full_page=True)
    print('POLICY', await pg.evaluate("JSON.stringify(policyAnalysis(S.policies[0]),(k,v)=>k==='items'?v.length:v)"))
    # add item via form
    await pg.evaluate("go('add')"); await pg.select_option('#f_cat','GLD'); await pg.fill('#f_name','Gold bar 100 g')
    await pg.fill('[name="details.purity"]','999.9'); await pg.fill('[name="details.netMetalWeight"]','100'); await pg.fill('[name="details.metalPriceCurrent"]','98')
    await pg.fill('#f_name',''); await pg.click('#itemf button[type=submit]'); await pg.wait_for_timeout(200)
    print('EMPTY NAME ERR:', await pg.text_content('#itemerr')); await pg.fill('#f_name','Gold bar 100 g')
    await pg.fill('[name=purchasePrice]','5800.5'); await pg.fill('[name=_ins]','9900'); await pg.click('#itemf button[type=submit]'); await pg.wait_for_timeout(400)
    print('NEW ITEM', await pg.evaluate("S.items.at(-1).id+' '+S.items.at(-1).details.karat+' '+JSON.stringify(metalValue(S.items.at(-1)))"))
    # upload a photo via file chooser
    await pg.set_input_files('#photof input[type=file]', f'{OUT}/01-dashboard.png'); await pg.click('#photof button[type=submit]'); await pg.wait_for_timeout(800)
    print('FILES', await pg.evaluate("S.files.length"))
    # export xlsx
    await pg.evaluate("go('import')")
    async with pg.expect_download() as dl: await pg.click('#expf button[type=submit]')
    d=await dl.value; await d.save_as(f'{OUT}/export.xlsx'); print('XLSX saved')
    await pg.select_option('[name=fmt]','csv')
    async with pg.expect_download() as dl: await pg.click('#expf button[type=submit]')
    d=await dl.value; await d.save_as(f'{OUT}/export.csv')
    # import the CSV back: duplicates -> skip by default
    await pg.set_input_files('#impfile', f'{OUT}/export.csv'); await pg.wait_for_timeout(500)
    await pg.click('[data-act=imp-validate]'); await pg.wait_for_timeout(300)
    print('IMPORT PREVIEW', await pg.eval_on_selector_all('#imppreview .pill','e=>e.map(x=>x.textContent)'))
    await pg.screenshot(path=f'{OUT}/05-import.png', full_page=True)
    # import messy test file
    open(f'{OUT}/messy.csv','w').write('Item name;Category code;Purchase price;Purchase date;Currency;Owner;Storage location;Inventory ID\nSilver tray;ANT;1.250,00;03.04.2019;EUR;Sachit Shrestha;Home – living room;\nBad row;XYZ;abc;31.02.2020;EURO;;;\nRing copy;JWL;300;2020-01-01;EUR;New Person;Office safe;JWL-2026-00001\n')
    await pg.set_input_files('#impfile', f'{OUT}/messy.csv'); await pg.wait_for_timeout(400)
    await pg.select_option('#dupmode','new'); await pg.click('[data-act=imp-validate]'); await pg.wait_for_timeout(300)
    print('MESSY', await pg.eval_on_selector_all('#imppreview tbody tr','e=>e.map(x=>x.textContent.replace(/\\s+/g," ").trim())'))
    await pg.click('[data-act=imp-run]'); await pg.wait_for_timeout(400)
    print('AFTER IMPORT items', await pg.evaluate("S.items.map(i=>i.id+':'+i.name+':'+i.purchasePrice+':'+i.purchaseDate).join(' | ')"))
    # backup
    await pg.evaluate("go('backup')"); await pg.click('[name=pwmode][value=own]'); await pg.fill('[name=pw1]','backup-pass-123456'); await pg.fill('[name=pw2]','backup-pass-123456')
    async with pg.expect_download(timeout=120000) as dl: await pg.click('#bkf button[type=submit]')
    d=await dl.value; await d.save_as(f'{OUT}/backup.vaultbak'); print('BACKUP', await pg.evaluate("JSON.stringify(S.backups.at(-1))"))
    # check nothing plaintext in IDB
    raw=await pg.evaluate("""(async()=>{const d=await idb();const r=await new Promise(res=>{const q=d.transaction('kv').objectStore('kv').get('db');q.onsuccess=()=>res(q.result)});return JSON.stringify(r).slice(0,200)})()""")
    print('IDB db record starts:', raw[:120]); print('plaintext leak?', 'Gold Necklace' in raw)
    # reports: open inventory report popup
    await pg.evaluate("go('reports')")
    for k in ['inventory','insurance','locker','estate','verification','missing','qr','photo']:
      async with pg.expect_popup() as pop: await pg.click(f'[data-act=report][data-kind={k}]')
      w=await pop.value; await w.wait_for_function("document.querySelector('main')", timeout=30000)
      if k in ('insurance','locker','inventory'): await w.screenshot(path=f'{OUT}/r-{k}.png', full_page=True)
      if k=='insurance': await w.pdf(path=f'{OUT}/insurance-report.pdf') if False else None
      await w.close()
    print('reports ok')
    # lock + wrong pw + unlock
    await pg.click('[data-act=lock]'); await pg.fill('#ul-pw','wrong'); await pg.click('#unl button'); await pg.wait_for_timeout(2500); print('WRONG:', await pg.text_content('#ul-err'))
    await pg.fill('#ul-pw',PW); await pg.click('#unl button'); await pg.wait_for_selector('#nav', timeout=60000); print('UNLOCKED items', await pg.evaluate('S.items.length'))
    # restore from backup into fresh context
    ctx2=await b.new_context(accept_downloads=True); pg2=await ctx2.new_page(); pg2.on('pageerror', lambda e: errs.append('PAGEERR2 '+str(e)))
    await pg2.goto(URL); await pg2.fill('#su-name','X'); await pg2.fill('#su-pw',PW); await pg2.fill('#su-pw2',PW); await pg2.uncheck('#su-sample'); await pg2.click('button[type=submit]'); await pg2.wait_for_selector('#nav',timeout=60000)
    await pg2.evaluate("go('backup')")
    async with pg2.expect_file_chooser() as fc: await pg2.click('[data-act=restore]')
    await (await fc.value).set_files(f'{OUT}/backup.vaultbak')
    await pg2.fill('#rs-pw','backup-pass-123456'); await pg2.click('dialog [data-ok]'); await pg2.wait_for_selector('#rs-info .callout', timeout=60000)
    print('RESTORE INFO', await pg2.text_content('#rs-info'))
    await pg2.click('dialog [data-ok]'); await pg2.wait_for_timeout(500); await pg2.locator('dialog [data-ok]').last.click(); await pg2.wait_for_function('S && S.items.length>0', timeout=60000)
    print('RESTORED items/files', await pg2.evaluate('[S.items.length,S.files.length]'))
    ok=await pg2.evaluate("(async()=>{const f=S.files[0];const b=await getBlob(f.id);return (await sha256hex(b))===f.sha256})()"); print('blob integrity after restore', ok)
    # mobile view
    await pg.set_viewport_size({'width':390,'height':844}); await pg.evaluate("go('dashboard')"); await pg.wait_for_timeout(200); await pg.screenshot(path=f'{OUT}/m-dashboard.png', full_page=True)
    await pg.evaluate("go('item',{id:'JWL-2026-00001'})"); await pg.screenshot(path=f'{OUT}/m-item.png', full_page=True)
    await b.close()
  print('ERRORS:', errs or 'none')
  if errs: raise SystemExit(1)
asyncio.run(main())
