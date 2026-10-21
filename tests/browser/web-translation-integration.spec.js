import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';

test('actual MV3 web adapters connect without keys, translate both directions and fall back safely using only localhost fixtures',async()=>{
  const calls=[];let context,failGoogle=false;
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;
    if(url.pathname==='/google/translate_a/single'){
      calls.push({id:'googleweb',source:url.searchParams.get('sl'),target:url.searchParams.get('tl')});res.writeHead(failGoogle?429:200,{'content-type':'application/json','retry-after':'2'});res.end(JSON.stringify([[url.searchParams.get('tl')==='en'?['Google translation.']:['谷歌译文。']]]));
    }else if(url.pathname==='/bing/translator'){
      calls.push({id:'bing-page'});res.writeHead(200,{'content-type':'text/html'});res.end('var params_AbusePreventionHelper = [123456,"browser-page-token",600000]; IG:"ABC123", <div id="rich_tta" data-iid="translator.42">');
    }else if(url.pathname==='/bing/ttranslatev3'){
      const data=new URLSearchParams(raw);calls.push({id:'bing',source:data.get('fromLang'),target:data.get('to')});expect(data.get('token')).toBe('browser-page-token');expect(req.headers.cookie).toBeUndefined();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify([{translations:[{text:data.get('to')==='en'?'Bing translation.':'必应译文。',to:data.get('to')}]}]));
    }else{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile('tests/browser/fixtures.html'));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-web-translation-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    expect((await ui.evaluate(async base=>{const {data}=await chrome.runtime.sendMessage({type:'state'});data.settings.siteOrigins=[base+'/*'];data.settings.debounce=400;return chrome.runtime.sendMessage({type:'save-settings',settings:data.settings});},base)).ok).toBe(true);
    await ui.reload();await ui.getByText('Web translation addresses',{exact:true}).click();await ui.locator('#googleweb-endpoint').fill(base+'/google');await ui.locator('#bing-endpoint').fill(base+'/bing');
    await ui.locator('[data-test="googleweb"]').click();await expect(ui.getByRole('status')).toHaveText('Google Translate (web, experimental): Google translation.');
    await ui.locator('[data-test="bing"]').click();await expect(ui.getByRole('status')).toHaveText('Microsoft Bing (web, experimental): Bing translation.');
    await ui.locator('#basicEngine').selectOption('googleweb');await ui.locator('#save').click();await expect(ui.getByRole('status')).toHaveText('Preferences saved.');
    const page=await context.newPage();await page.goto(base);const draft=page.getByRole('textbox',{name:'Draft',exact:true}),tip=page.locator('input-coach-tip');await draft.fill('网页接口测试。');await expect(tip.locator('.suggestion')).toHaveText('Google translation.');await tip.locator('.site-policy>summary').click();await expect(tip.getByLabel('Website translation engine').locator('option[value="bing"]')).toHaveCount(1);
    await ui.locator('#targetLanguage').selectOption('zh');await ui.locator('#basicEngine').selectOption('bing');await ui.locator('#save').click();await expect(ui.getByRole('status')).toHaveText('Preferences saved.');await draft.fill('This is a synthetic web translation.');await expect(tip.locator('.suggestion')).toHaveText('必应译文。');expect(calls.at(-1)).toMatchObject({id:'bing',source:'en',target:'zh-Hans'});expect(calls.filter(c=>c.id==='bing-page')).toHaveLength(1);
    failGoogle=true;await ui.locator('#targetLanguage').selectOption('en');await ui.locator('#basicEngine').selectOption('googleweb');await ui.locator('#save').click();await expect(ui.getByRole('status')).toHaveText('Preferences saved.');await draft.fill('谷歌限流后使用必应。');await expect(tip.locator('.suggestion')).toHaveText('Bing translation.');
    const state=await ui.evaluate(async()=>({data:(await chrome.runtime.sendMessage({type:'state'})).data,local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));expect(state.data.basicStatus.attempts.map(a=>a.status)).toEqual(['rate','success']);expect(state.data.hasKeys).toEqual({llm:false,libre:false,azure:false,google:false});
    const stored=JSON.stringify({local:state.local,session:state.session});expect(stored).not.toContain('browser-page-token');
    const {translationHistory,...nonHistory}=state.local;
    expect(translationHistory.some(row=>row.source==='谷歌限流后使用必应。')).toBe(true);
    expect(JSON.stringify({local:nonHistory,session:state.session,data:state.data})).not.toContain('谷歌限流后');
    await ui.locator('#engines').screenshot({path:'test-results/web-engines-en.png',style:'.save-bar,.section-nav{visibility:hidden}'});
  }finally{
    await context?.close();await new Promise(resolve=>server.close(resolve));const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});
  }
});
