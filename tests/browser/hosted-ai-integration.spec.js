import {test,expect,chromium} from '@playwright/test';import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import hostedWorker from '../../cloudflare/src/worker.js';

test('actual MV3 keyless AI uses the Worker contract, preserves host sizing and keeps MT with bilingual daily quota alerts',async()=>{
  let context,exhausted=false,aiCalls=0,coachCalls=0;
  const env={PREVIEW_ENABLED:'true',PREVIEW_UNTIL:'',ALLOWED_ORIGINS:'',CLIENT_LIMIT:{limit:async()=>({success:true})},SERVICE_LIMIT:{limit:async()=>({success:true})},AI:{run:async()=>{aiCalls++;if(exhausted)throw Object.assign(new Error('3036 daily free allocation'),{code:3036});return {choices:[{message:{content:'{"text":"AI translation.","vocabulary":[]}'}}],usage:{total_tokens:42}};}}};
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;
    if(url.pathname==='/v1/coach'){
      coachCalls++;const response=await hostedWorker.fetch(new Request(url,{method:'POST',headers:req.headers,body:raw}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
    }else if(url.pathname==='/get'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:'Fast translation.'}}));}
    else{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile('tests/browser/fixtures.html'));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-hosted-integration-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    const saved=await ui.evaluate(async base=>{const {data}=await chrome.runtime.sendMessage({type:'state'}),s=data.settings;s.siteOrigins=[base+'/*'];s.debounce=400;s.basicEngine='mymemory';s.basicFallback=false;s.basic.mymemory={consent:true,endpoint:base};s.llm={...s.llm,provider:'saywell',enabled:true,consent:true,endpoint:base+'/v1'};return chrome.runtime.sendMessage({type:'save-settings',settings:s});},base);expect(saved.ok).toBe(true);
    const page=await context.newPage();await page.goto(base);const draft=page.getByRole('textbox',{name:'Draft',exact:true}),tip=page.locator('input-coach-tip');await draft.fill('免费 AI 测试。');await expect(tip.locator('.suggestion')).toHaveText('AI translation.');expect(aiCalls).toBe(1);
    await tip.getByRole('combobox',{name:'Tooltip size',exact:true}).selectOption('medium');await expect(tip).toHaveAttribute('data-size','medium');await expect(tip.locator('.suggestion')).toHaveText('AI translation.');expect(aiCalls).toBe(1);
    await expect.poll(async()=>ui.evaluate(async()=>(await chrome.storage.local.get('tooltipSizes')).tooltipSizes?.['127.0.0.1'])).toBe('medium');
    exhausted=true;await draft.fill('额度耗尽后保留机器翻译。');await expect(tip.locator('.suggestion')).toHaveText('Fast translation.');await expect(tip.getByText(/Saywell free AI quota is exhausted/)).toBeVisible();expect(aiCalls).toBe(2);expect(coachCalls).toBe(2);
    await draft.fill('冷却期间不再调用免费 AI。');await expect(tip.locator('.suggestion')).toHaveText('Fast translation.');await expect(tip.getByText(/Saywell free AI quota is exhausted/)).toBeVisible();expect(coachCalls).toBe(2);
    await ui.evaluate(()=>chrome.storage.local.set({uiLanguage:'zh-CN'}));await draft.fill('中文额度提醒。');await expect(tip.getByText(/今日额度已耗尽/)).toBeVisible();await expect(tip).toHaveAttribute('data-size','medium');
    await tip.screenshot({path:'test-results/hosted-quota-tooltip-zh.png'});await tip.getByRole('button',{name:'Apply ↗',exact:true}).click();await expect(draft).toHaveValue('Fast translation.');
    const stored=await ui.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));expect(JSON.stringify(stored)).not.toContain('额度耗尽后保留');expect(Object.values(stored.session.keys || {}).some(Boolean)).toBe(false);
  }finally{await context?.close();await new Promise(resolve=>server.close(resolve));const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});}
});
