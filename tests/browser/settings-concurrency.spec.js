import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
let context,root,extensionId;
test.beforeAll(async()=>{
  root=await mkdtemp(path.join(os.tmpdir(),'saywell-settings-concurrency-'));const extension=path.resolve('dist');
  context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',headless:true,locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  await context.route(/^https?:/,route=>route.abort());const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');extensionId=new URL(worker.url()).host;
});
test.afterAll(async()=>{await context?.close();await rm(root,{recursive:true,force:true});});
async function settingsPage(){
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/settings.html`);await page.locator('#ui-language').selectOption('en');await expect(page.locator('#llm-profile')).toHaveValue('default');return page;
}
async function holdSave(page,{afterWrite=false}={}){
  await page.evaluate(afterWrite=>{
    const original=chrome.runtime.sendMessage.bind(chrome.runtime);window.__originalMessage=original;window.__calls=[];window.__hold=true;
    chrome.runtime.sendMessage=async message=>{
      if(['save-settings','forget-keys'].includes(message.type))window.__calls.push({type:message.type,hasKey:Boolean(message.keys?.azure)});
      if(message.type==='forget-keys' && window.__forgetFailure)return {ok:false,error:'Synthetic key removal failed.'};
      if(message.type==='save-settings' && window.__hold){window.__hold=false;const result=afterWrite?await original(message):null;await new Promise(resolve=>window.__resumeSave=resolve);return afterWrite?result:original(message);}
      return original(message);
    };
  },afterWrite);
}
test('forget keys drains captured autosaves and prevents credentials being saved again',async()=>{
  const page=await settingsPage();try{
    await holdSave(page);await page.locator('#dailyGoal').fill('411');await page.waitForFunction(()=>window.__resumeSave);
    await page.locator('#azure-key').evaluate(input=>{for(let el=input.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});
    await page.locator('#azure-key').fill('synthetic-forget-key');await page.locator('#dailyGoal').fill('412');await page.waitForTimeout(750);
    await page.locator('#forget-keys').click();await expect(page.locator('#azure-key')).toBeDisabled();await expect(page.locator('#dailyGoal')).toBeDisabled();
    await page.evaluate(()=>window.__resumeSave());await expect(page.locator('#azure-key')).toBeEnabled();await expect(page.locator('#azure-key')).toHaveValue('');
    await expect.poll(()=>page.evaluate(()=>window.__calls.some(call=>call.type==='forget-keys'))).toBe(true);await page.waitForTimeout(800);
    const result=await page.evaluate(async()=>({state:(await chrome.runtime.sendMessage({type:'state'})).data,calls:window.__calls}));
    expect(result.state.hasKeys.azure).toBe(false);expect(result.calls.slice(result.calls.findIndex(call=>call.type==='forget-keys')+1).some(call=>call.hasKey)).toBe(false);
  }finally{await page.close();}
});
test('failed key removal restores editing and preserves pending input for a retry',async()=>{
  const page=await settingsPage();try{
    await holdSave(page);await page.locator('#azure-key').evaluate(input=>{for(let el=input.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});
    await page.locator('#azure-key').fill('synthetic-retry-key');await page.waitForFunction(()=>window.__resumeSave);await page.evaluate(()=>window.__forgetFailure=true);
    await page.locator('#forget-keys').click();await expect(page.locator('#azure-key')).toBeDisabled();await page.evaluate(()=>window.__resumeSave());
    await expect(page.locator('#status')).toHaveText('Synthetic key removal failed.');await expect(page.locator('#azure-key')).toBeEnabled();await expect(page.locator('#azure-key')).toHaveValue('synthetic-retry-key');
    await page.evaluate(()=>window.__forgetFailure=false);await page.locator('#forget-keys').click();await expect(page.locator('#azure-key')).toHaveValue('');await expect.poll(()=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.hasKeys.azure)).toBe(false);
  }finally{await page.close();}
});
test('delayed save acknowledgements retain concurrent popup choices and newer form edits',async()=>{
  const page=await settingsPage();try{
    await page.evaluate(async()=>{await chrome.runtime.sendMessage({type:'set-target-language',targetLanguage:'en'});await chrome.runtime.sendMessage({type:'toggle',enabled:true});});
    await expect(page.locator('#targetLanguage')).toHaveValue('en');await holdSave(page,{afterWrite:true});await page.locator('#dailyGoal').fill('521');await page.waitForFunction(()=>window.__resumeSave);
    await page.evaluate(async()=>{await window.__originalMessage({type:'set-target-language',targetLanguage:'zh'});await window.__originalMessage({type:'toggle',enabled:false});const {settings}=await chrome.storage.local.get('settings');settings.blocklist=['synthetic-blocked.example'];await chrome.storage.local.set({settings});});
    await page.locator('#dailyGoal').fill('522');await page.waitForTimeout(750);await page.evaluate(()=>window.__resumeSave());
    await expect(page.locator('#targetLanguage')).toHaveValue('zh');await expect(page.locator('#dailyGoal')).toHaveValue('522');await expect(page.locator('#dailyGoal')).toBeFocused();await expect(page.locator('#enabled')).not.toBeChecked();
    await expect.poll(()=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings.dailyGoal)).toBe(522);
    await page.locator('#style').selectOption('professional');await expect.poll(()=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings.style)).toBe('professional');
    const settings=await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings);expect(settings.targetLanguage).toBe('zh');expect(settings.enabled).toBe(false);expect(settings.blocklist).toEqual(['synthetic-blocked.example']);
  }finally{await page.close();}
});
test('rebasing an endpoint change clears unsaved keys tied to the previously displayed identity',async()=>{
  const page=await settingsPage();try{
    await page.locator('#libre-endpoint').evaluate(input=>{for(let el=input.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;});
    await page.locator('#libre-endpoint').fill('https://synthetic-a.example');await expect.poll(()=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings.basic.libre.endpoint)).toBe('https://synthetic-a.example');
    await page.locator('#libre-key').fill('synthetic-key-for-a');
    await page.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');settings.basic.libre.endpoint='https://synthetic-b.example';await chrome.storage.local.set({settings});});
    await expect(page.locator('#libre-endpoint')).toHaveValue('https://synthetic-b.example');await expect(page.locator('#libre-key')).toHaveValue('');await page.waitForTimeout(800);
    expect((await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data)).hasKeys.libre).toBe(false);
  }finally{await page.close();}
});
