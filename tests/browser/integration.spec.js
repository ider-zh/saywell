import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';

test('real MV3 messaging, automatic failover, local analytics and LLM adapter work together',async()=>{
  const requests=[];let failMemory=false,failEdge=false,context;
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');let body='';for await(const chunk of req)body+=chunk;
    if(url.pathname==='/translate/translatetext'){requests.push({kind:'microsoft',body:JSON.parse(body)});res.writeHead(failEdge?503:200,{'content-type':'application/json'});res.end(JSON.stringify([{translations:[{text:'Microsoft fallback works.',to:'en'}]}]));}
    else if(url.pathname==='/get'){requests.push({kind:'mymemory',text:url.searchParams.get('q')});res.writeHead(failMemory?503:200,{'content-type':'application/json'});res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:'Hello, world.'}}));}
    else if(url.pathname==='/languages'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify([{code:'zh',targets:['en']}]));}
    else if(url.pathname==='/translate'){requests.push({kind:'libre',body:JSON.parse(body)});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({translatedText:'Please review this PR.'}));}
    else if(url.pathname==='/v1/chat/completions'){requests.push({kind:'llm',body:JSON.parse(body)});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'We should streamline this process.',explanation:'精简表达。',vocabulary:[{word:'streamline',meaning:'精简'}]})}}]}));}
    else{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile('tests/browser/fixtures.html'));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const root=await mkdtemp(path.join(os.tmpdir(),'input-coach-integration-'));
  try{
    await cp('dist',path.join(root,'extension'),{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));
    // Test-only grants: localhost fixtures plus four preset hosts to exercise permission UI without dialogs.
    // The production archive retains zero required host_permissions.
    manifest.host_permissions=[base+'/*','https://translate.googleapis.com/*','https://cn.bing.com/*','https://edge.microsoft.com/*','https://api.mymemory.translated.net/*'];await writeFile(path.join(root,'extension','manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${path.join(root,'extension')}`,`--load-extension=${path.join(root,'extension')}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
    const ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    await ui.getByRole('button',{name:'Enable free translation',exact:true}).click();
    await expect(ui.getByRole('status')).toContainText('No-key fallback enabled.');
    const preset=await ui.evaluate(async()=>{const r=await chrome.runtime.sendMessage({type:'state'});return r.data;});
    expect(preset.settings.basic.microsoft.consent).toBe(true);expect(preset.settings.basic.mymemory.consent).toBe(true);expect(preset.hasKeys.llm).toBe(false);expect(preset.settings.basicFallback).toBe(true);expect(requests).toEqual([]);
    const configure=async llm=>{
      const reply=await ui.evaluate(async({base,llm})=>{
        const state=await chrome.runtime.sendMessage({type:'state'});const s=state.data.settings;s.siteOrigins=[base+'/*'];s.debounce=400;s.basicEngine='auto';s.basic.googleweb.consent=false;s.basic.bing.consent=false;s.basic.microsoft={consent:false,endpoint:base};s.basic.mymemory={consent:true,endpoint:base};s.basic.libre={consent:true,endpoint:base};
        s.llm={...s.llm,enabled:llm,provider:'ollama',endpoint:base+'/v1',model:'fixture',consent:llm};
        return chrome.runtime.sendMessage({type:'save-settings',settings:s});
      },{base,llm});expect(reply.ok).toBe(true);
    };
    await configure(false);
    const page=await context.newPage();await page.goto(base);const draft=page.getByRole('textbox',{name:'Draft',exact:true});
    await draft.fill('你好，世界。');const tip=page.locator('input-coach-tip');await expect(tip.getByText('Hello, world.',{exact:true})).toBeVisible();expect(requests[0].text).toBe('你好，世界。');await expect(draft).toHaveValue('你好，世界。');
    const initial=await tip.boundingBox();await tip.getByRole('button',{name:'Move tooltip',exact:true}).focus();await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async()=>ui.evaluate(async()=>Boolean((await chrome.storage.local.get('tooltipPositions')).tooltipPositions?.['127.0.0.1']))).toBe(true);
    const moved=await tip.boundingBox();expect(moved.x).toBeCloseTo(initial.x+40,0);
    await page.reload();await draft.fill('你好，世界。');await expect(tip.getByText('Hello, world.',{exact:true})).toBeVisible();
    expect((await tip.boundingBox()).x).toBeCloseTo(moved.x,0);
    await tip.getByRole('button',{name:'Apply'}).click();await expect(draft).toHaveValue('Hello, world.');
    await expect.poll(async()=>ui.evaluate(async()=>{const r=await chrome.runtime.sendMessage({type:'state'});return Object.values(r.data.analytics || {}).reduce((n,d)=>n+d.ai,0);})).toBe(13);
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});await page.evaluate(()=>navigator.clipboard.writeText('external phrase'));await draft.focus();await page.keyboard.press('Control+End');await page.keyboard.press('Control+V');
    await expect.poll(async()=>ui.evaluate(async()=>{const r=await chrome.runtime.sendMessage({type:'state'});return Object.values(r.data.analytics || {}).reduce((n,d)=>n+d.pasted,0);})).toBe(15);
    await draft.fill('测试真实黑名单控制。');await expect(tip.getByText('Not on blacklist',{exact:true})).toHaveCount(0);await tip.locator('.site-policy>summary').click();await tip.getByRole('button',{name:'Add this site to blacklist',exact:true}).click();
    await expect(tip.locator('.site-blocked')).toBeVisible();const blockedCount=requests.length;
    await draft.fill('加入黑名单后不再发送文本。');await page.waitForTimeout(1100);expect(requests.length).toBe(blockedCount);
    await draft.press('Alt+Shift+E');await expect(tip.getByRole('button',{name:'Remove this site from blacklist',exact:true})).toBeVisible();await tip.getByRole('button',{name:'Remove this site from blacklist',exact:true}).click();
    await expect(tip.getByText('Not on blacklist',{exact:true})).toHaveCount(0);
    await ui.evaluate(async()=>chrome.runtime.sendMessage({type:'set-site-mode',mode:'whitelist'}));await draft.fill('空白名单不发送请求。');await page.waitForTimeout(1100);expect(requests.length).toBe(blockedCount);
    await ui.evaluate(async base=>{const r=await chrome.runtime.sendMessage({type:'state'});const s=r.data.settings;s.allowlist=[new URL(base).hostname];return chrome.runtime.sendMessage({type:'save-settings',settings:s});},base);
    await draft.fill('白名单中的网站可以继续翻译。');await expect(tip.getByText('Hello, world.',{exact:true})).toBeVisible();await tip.locator('.site-policy>summary').click();await expect(tip.getByText('Whitelist mode',{exact:true})).toBeVisible();
    await ui.evaluate(async()=>chrome.runtime.sendMessage({type:'set-site-mode',mode:'blacklist'}));
    failMemory=true;await draft.fill('请检查这个 PR。');await expect(tip.getByText('Please review this PR.',{exact:true})).toBeVisible();await expect(tip.getByText('Basic translation · LibreTranslate')).toBeVisible();expect(requests.some(r=>r.kind==='libre')).toBe(true);
    const updateFallback=async enabled=>{
      const reply=await ui.evaluate(async({base,enabled})=>{
        const r=await chrome.runtime.sendMessage({type:'state'});const s=r.data.settings;s.basicEngine='mymemory';s.basicFallback=enabled;s.basic.microsoft={consent:true,endpoint:base};return chrome.runtime.sendMessage({type:'save-settings',settings:s});
      },{base,enabled});expect(reply.ok).toBe(true);
    };
    await updateFallback(true);await draft.fill('手动选择的引擎失败时也应回退。');await expect(tip.getByText('Microsoft fallback works.',{exact:true})).toBeVisible();expect(requests.find(r=>r.kind==='microsoft').body).toEqual(['手动选择的引擎失败时也应回退。']);
    failEdge=true;await draft.fill('微软接口不可用时尝试下一个授权引擎。');await expect(tip.getByText('Please review this PR.',{exact:true})).toBeVisible();
    const report=await ui.evaluate(async()=>{const r=await chrome.runtime.sendMessage({type:'state'});return r.data.basicStatus;});expect(report.attempts.some(a=>a.id==='microsoft'&&a.status==='server')).toBe(true);expect(report.engine).toBe('LibreTranslate');expect(JSON.stringify(report)).not.toContain('微软接口');
    await updateFallback(false);const before=requests.length;await draft.fill('关闭回退后只测试主引擎。');await expect(tip.getByText(/MyMemory: Provider returned HTTP 503/)).toBeVisible();expect(requests.slice(before).map(r=>r.kind)).toEqual(['mymemory']);
    await configure(true);await draft.fill('We should make this process more simple.');await expect(tip.getByRole('button',{name:'streamline',exact:true})).toBeVisible();expect(requests.some(r=>r.kind==='llm'&&r.body.model==='fixture')).toBe(true);
    await tip.getByRole('button',{name:'streamline',exact:true}).click();await tip.getByRole('button',{name:'Save for review',exact:true}).click();
    const state=await ui.evaluate(async()=>{const r=await chrome.runtime.sendMessage({type:'state'});return r.data;});expect(state.vocabulary[0].word).toBe('streamline');expect(state.vocabulary[0].context).toBeUndefined();expect(JSON.stringify(state.analytics)).not.toContain('external phrase');
    await page.screenshot({path:'test-results/tooltip.png'});
    const availability=await ui.evaluate(async()=>({exposed:typeof Translator!=='undefined',availability:typeof Translator!=='undefined'?await Translator.availability({sourceLanguage:'zh',targetLanguage:'en'}):'unavailable'}));
    console.log('Test Chromium local Translator probe:',JSON.stringify(availability));
    const isolated=await ui.evaluate(async base=>{
      const [tab]=await chrome.tabs.query({url:base+'/*'});
      const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:async()=>({exposed:typeof Translator!=='undefined',availability:typeof Translator!=='undefined'?await Translator.availability({sourceLanguage:'zh',targetLanguage:'en'}):'unavailable'})});
      return result.result;
    },base);
    console.log('Test Chromium isolated content Translator probe:',JSON.stringify(isolated));
  }finally{await context?.close();await new Promise(resolve=>server.close(resolve));const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Refusing unsafe cleanup path');await rm(absolute,{recursive:true,force:true});}
});
