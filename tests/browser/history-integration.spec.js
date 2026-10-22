import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';

test('actual MV3 history merges visible parallel results, rejects late results after clear, searches, exports and persists rolling preferences',async()=>{
  let release,hold=true,requests=0,context;
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    if(req.url.startsWith('/get')){requests++;res.setHeader('content-type','application/json');res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:'Machine fixture.'}}));}
    else if(req.url==='/v1/chat/completions'){
      requests++;if(hold)await new Promise(resolve=>{release=resolve;});
      res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'AI fixture.',vocabulary:[]})}}]}));
    }else{res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><textarea aria-label="Draft"></textarea></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-history-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',headless:true,locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/history.html`);
    expect(await ui.evaluate(async base=>{
      const {data}=await chrome.runtime.sendMessage({type:'state'}),s=data.settings;for(const c of Object.values(s.basic))c.consent=false;
      Object.assign(s,{basicEngine:'mymemory',debounce:400,siteOrigins:[base+'/*']});s.basic.mymemory={consent:true,endpoint:base};
      Object.assign(s.llm,{enabled:true,provider:'compatible',endpoint:base+'/v1',model:'synthetic',consent:true});
      return (await chrome.runtime.sendMessage({type:'save-settings',settings:s,keys:{llm:'synthetic-history-key'}})).ok;
    },base)).toBe(true);
    const page=await context.newPage();await page.goto(base);const draft=page.getByRole('textbox',{name:'Draft'}),tip=page.locator('input-coach-tip');await draft.fill('这是历史测试。');
    await expect(tip.locator('.suggestion')).toHaveText('Machine fixture.');await expect(ui.locator('.history-entry')).toHaveCount(1);
    expect(await ui.locator('#history-limit').inputValue()).toBe('100');await expect.poll(()=>Boolean(release)).toBe(true);release();
    await expect(tip.locator('.suggestion')).toHaveText('AI fixture.');await expect(ui.locator('.history-excerpt').last()).toHaveText('AI fixture.');
    const saved=await ui.evaluate(async()=>(await chrome.runtime.sendMessage({type:'get-history'})).data);expect(saved.records).toHaveLength(1);expect(Object.keys(saved.records[0].results).sort()).toEqual(['llm','mt']);
    release=undefined;await draft.fill('清空后迟到的结果。');await expect(tip.locator('.suggestion')).toHaveText('Machine fixture.');await expect(ui.locator('.history-entry')).toHaveCount(2);await expect.poll(()=>Boolean(release)).toBe(true);
    await ui.evaluate(()=>chrome.runtime.sendMessage({type:'clear-history'}));await expect(ui.locator('.history-entry')).toHaveCount(0);release();await expect(tip.locator('.suggestion')).toHaveText('AI fixture.');await page.waitForTimeout(200);await expect(ui.locator('.history-entry')).toHaveCount(0);
    await ui.evaluate(async row=>{await chrome.storage.local.set({translationHistory:Array.from({length:100},(_,i)=>({...row,id:'seed-'+i,source:i===0?'<img src=x onerror=alert(1)> needle':'Synthetic source '+i,createdAt:new Date(Date.now()-i*1000).toISOString()}))});await chrome.runtime.sendMessage({type:'get-history'});},saved.records[0]);
    await expect(ui.locator('#history-count')).toContainText('100');await ui.locator('#history-search').fill('needle');await expect(ui.locator('.history-entry')).toHaveCount(1);await expect(ui.locator('#history-list img')).toHaveCount(0);
    const downloading=ui.waitForEvent('download');await ui.locator('#history-export').click();const download=await downloading,raw=await readFile(await download.path(),'utf8'),exported=JSON.parse(raw);
    expect(download.suggestedFilename()).toBe('saywell-history.json');expect(exported.records).toHaveLength(1);expect(exported.records[0].source).toContain('<img');expect(raw).not.toContain('synthetic-history-key');
    await ui.locator('#history-search').fill('');await ui.locator('#history-limit').selectOption('50');await expect(ui.locator('#history-count')).toHaveText('50 of 50 records');
    await ui.evaluate(()=>scrollTo(0,document.body.scrollHeight));await expect.poll(()=>ui.locator('.history-entry').count()).toBe(50);
    await ui.locator('#history-limit').selectOption('0');hold=false;await draft.fill('关闭历史仍可翻译。');await expect(tip.locator('.suggestion')).toHaveText('AI fixture.');
    await expect(ui.locator('#history-count')).toHaveText('50 of 50 records');await ui.reload();await expect(ui.locator('#history-limit')).toHaveValue('0');await expect(ui.locator('#history-count')).toHaveText('50 of 50 records');
    const before=requests;await ui.locator('#ui-language').selectOption('zh-CN');await expect(ui.getByRole('heading',{name:'翻译历史',exact:true})).toBeVisible();await ui.setViewportSize({width:390,height:900});expect(await ui.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await ui.screenshot({path:'test-results/history-mobile-zh.png'});
    await ui.locator('#history-clear').click();await expect(ui.locator('.history-entry')).toHaveCount(0);expect(requests).toBe(before);
  }finally{
    release?.();await context?.close();await new Promise(resolve=>server.close(resolve));if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(root,{recursive:true,force:true});
  }
});
