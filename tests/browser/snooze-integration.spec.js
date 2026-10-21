import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
test('actual MV3 site/all pauses survive reload, stop remote processing and resume from popup or expiry',async()=>{
  let context,calls=0;
  const server=createServer((req,res)=>{res.setHeader('content-type',req.url.startsWith('/get')?'application/json':'text/html');if(req.url.startsWith('/get')){calls++;res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:'Synthetic translation.'}}));}else res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><textarea aria-label="Draft"></textarea></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,other=`http://localhost:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-snooze-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*',other+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',headless:true,locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    expect(await ui.evaluate(async({base,other})=>{const {data}=await chrome.runtime.sendMessage({type:'state'}),s=data.settings;Object.assign(s,{siteOrigins:[base+'/*',other+'/*'],basicEngine:'mymemory',basicFallback:false,debounce:400});s.basic.mymemory={consent:true,endpoint:base};s.llm.enabled=false;return(await chrome.runtime.sendMessage({type:'save-settings',settings:s})).ok;},{base,other})).toBe(true);
    const a=await context.newPage(),b=await context.newPage();await a.goto(base);await b.goto(other);
    const draft=page=>page.getByRole('textbox',{name:'Draft'}),tip=page=>page.locator('input-coach-tip');
    for(const page of [a,b]){await draft(page).fill('这是合成测试。');await expect(tip(page).locator('.suggestion')).toHaveText('Synthetic translation.');}
    await tip(a).getByRole('button',{name:'Pause temporarily',exact:true}).click();await tip(a).getByLabel('Pause for',{exact:true}).selectOption('1h');await tip(a).getByRole('button',{name:'Pause',exact:true}).click();await expect(tip(a)).toHaveCount(0);await expect(tip(b)).toBeVisible();
    const paused=calls;await a.reload();await draft(a).fill('刷新后仍然暂停。');await a.waitForTimeout(1000);expect(calls).toBe(paused);
    await draft(b).fill('另一个网站继续翻译。');await expect(tip(b).locator('.suggestion')).toBeVisible();expect(calls).toBe(paused+1);
    await a.bringToFront();const opened=context.waitForEvent('page');await worker.evaluate(()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html'),active:false}));const popup=await opened;
    await expect(popup.locator('#resume-snooze-site')).toBeVisible();await popup.locator('#resume-snooze-site').click();await expect(popup.locator('#snooze-status')).toBeHidden();await draft(a).fill('提前恢复当前网站。');await expect(tip(a).locator('.suggestion')).toBeVisible();
    await tip(a).getByRole('button',{name:'Pause temporarily',exact:true}).click();await tip(a).getByLabel('Pause for',{exact:true}).selectOption('4h');await tip(a).getByLabel('Pause on',{exact:true}).selectOption('all');await tip(a).getByRole('button',{name:'Pause',exact:true}).click();await expect(tip(a)).toHaveCount(0);await expect(tip(b)).toHaveCount(0);
    await expect(popup.locator('#resume-snooze-all')).toBeVisible();const allPaused=calls;await draft(b).fill('全部暂停时不调用。');await b.waitForTimeout(1100);expect(calls).toBe(allPaused);
    await popup.locator('#resume-snooze-all').click();await expect(popup.locator('#snooze-status')).toBeHidden();
    await worker.evaluate(()=>chrome.storage.local.set({snoozes:{all:Date.now()+400,sites:{}}}));await b.waitForTimeout(750);await draft(b).fill('到期自动恢复翻译。');await expect(tip(b).locator('.suggestion')).toBeVisible();expect(calls).toBe(allPaused+1);
    await expect(popup.locator('#snooze-status')).toBeHidden();
  }finally{await context?.close();await new Promise(resolve=>server.close(resolve));if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(root,{recursive:true,force:true});}
});
