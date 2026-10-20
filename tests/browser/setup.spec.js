import {test,expect,chromium} from '@playwright/test';
import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';

test('first-use denial persists warnings, one authorization enables free features, and revoked access can be restored',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'saywell-setup-'));let context;
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});
    const manifest=JSON.parse(await readFile('manifest.json','utf8'));
    // Test-only broad grants replace the headless native dialog. Production stays optional.
    manifest.host_permissions=['http://*/*','https://*/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
    const page=await context.newPage();await page.goto(`chrome-extension://${id}/welcome.html`);
    await expect(page.locator('#setup-enable')).toHaveText('Allow and start using Saywell');
    await page.screenshot({path:'test-results/setup-welcome-en.png'});
    await expect.poll(()=>worker.evaluate(()=>chrome.action.getBadgeText({}))).toBe('!');
    // Simulate the browser refusing the first native permission request.
    await page.evaluate(()=>{window.__request=chrome.permissions.request;window.__permissionCalls=[];chrome.permissions.request=async value=>{window.__permissionCalls.push(value);return false;};});
    await page.locator('#setup-enable').click();await expect(page.getByRole('status')).toContainText('was not granted');
    expect(await page.evaluate(()=>window.__permissionCalls)).toEqual([{origins:['https://*/*','http://*/*']}]);
    expect(await worker.evaluate(async()=>{const s=(await chrome.storage.local.get('settings')).settings;return {llm:s.llm.consent,mt:s.basic.googleweb.consent};})).toEqual({llm:false,mt:false});
    const settings=await context.newPage();await settings.goto(`chrome-extension://${id}/settings.html`);await expect(settings.locator('#setup-notice')).toBeVisible();
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);await expect(popup.locator('#setup-notice')).toBeVisible();
    await page.reload();await expect(page.locator('#setup-enable')).toBeVisible();
    await page.locator('#setup-enable').click();await expect(page.locator('#setup-title')).toHaveText('You’re ready to write.');
    await expect.poll(()=>worker.evaluate(()=>chrome.action.getBadgeText({}))).toBe('');
    await expect(settings.locator('#setup-notice')).toBeHidden();await expect(popup.locator('#setup-notice')).toBeHidden();
    const saved=await worker.evaluate(async()=>(await chrome.storage.local.get('settings')).settings);
    expect(saved).toMatchObject({enabled:true,autoSuggest:true,basicFallback:true,basicEngine:'auto',maxWords:3,siteMode:'blacklist',siteOrigins:['https://*/*','http://*/*'],llm:{enabled:true,consent:true,provider:'saywell',thinking:false}});
    for(const id of ['googleweb','bing','microsoft','mymemory'])expect(saved.basic[id].consent).toBe(true);
    await worker.evaluate(async()=>{
      const raw=chrome.permissions.contains;globalThis.__contains=raw;chrome.permissions.contains=async query=>query.origins?.includes('http://*/*')?false:raw(query);
      await chrome.storage.local.set({uiLanguage:'zh-CN'});
    });
    await expect.poll(()=>worker.evaluate(()=>chrome.action.getBadgeText({}))).toBe('!');
    await popup.reload();await expect(popup.locator('#setup-enable')).toHaveText('重新申请授权');
    await worker.evaluate(()=>{chrome.permissions.contains=globalThis.__contains;});
    await popup.locator('#setup-enable').click();await expect(popup.locator('#setup-notice')).toBeHidden();
    await expect.poll(()=>worker.evaluate(()=>chrome.action.getBadgeText({}))).toBe('');
    await page.locator('#ui-language').selectOption('zh-CN');await expect(page.locator('h1')).toHaveText('你的表达，更清晰一点。');
    await page.setViewportSize({width:390,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/setup-ready-zh.png'});
  }finally{
    await context?.close();if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(root,{recursive:true,force:true});
  }
});
