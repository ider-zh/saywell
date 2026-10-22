import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
test('actual store build refuses retired adapters even with legacy consent and endpoint grants',async()=>{
  let context,calls=0;const server=createServer((req,res)=>{calls++;res.end('unexpected provider call');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-retired-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    for(const provider of ['googleweb','bing','microsoft']){
      const result=await ui.evaluate(async({base,provider})=>{const {data}=await chrome.runtime.sendMessage({type:'state'});data.settings.basic[provider]={consent:true,endpoint:base};data.settings.basicEngine=provider;await chrome.storage.local.set({settings:data.settings});return chrome.runtime.sendMessage({type:'test-basic',id:provider});},{base,provider});
      expect(result.ok).toBe(false);expect(result.error).toContain('unavailable in the store build');
    }
    await ui.reload();await expect(ui.locator('#enable-free')).toBeHidden();for(const provider of ['googleweb','bing','microsoft']){await expect(ui.locator(`[data-test="${provider}"]`)).toBeHidden();await expect(ui.locator(`#basicEngine option[value="${provider}"]`)).toHaveCount(0);}expect(calls).toBe(0);
  }finally{await context?.close();await new Promise(resolve=>server.close(resolve));if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(root,{recursive:true,force:true});}
});
