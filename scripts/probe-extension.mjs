// Explicit live smoke probe. Sends only the fixed synthetic test phrase, using a temporary browser profile.
import {chromium} from '@playwright/test';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
const root=await mkdtemp(path.join(os.tmpdir(),'input-coach-live-probe-'));let context;
try{
  const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});
  const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
  manifest.host_permissions=['https://translate.googleapis.com/*','https://cn.bing.com/*','https://edge.microsoft.com/*','https://api.mymemory.translated.net/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',headless:true,...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  const ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
  await ui.getByRole('button',{name:'Enable free translation',exact:true}).click();
  for(const targetLanguage of process.argv.includes('--web')?['en','zh']:['en']){
  await ui.evaluate(async targetLanguage=>{const {data}=await chrome.runtime.sendMessage({type:'state'});data.settings.targetLanguage=targetLanguage;const result=await chrome.runtime.sendMessage({type:'save-settings',settings:data.settings});if(!result.ok)throw new Error(result.error);},targetLanguage);
  for(const provider of process.argv.includes('--web')?['googleweb','bing']:['microsoft','mymemory','auto']){
    const result=await ui.evaluate(async id=>{
      const r=await chrome.runtime.sendMessage({type:'test-basic',id});return r.ok?{ok:true,engine:r.data.engine,text:r.data.text,attempts:r.data.attempts}:{ok:false,error:r.error};
    },provider);
    console.log(JSON.stringify({timestamp:new Date().toISOString(),provider,targetLanguage,...result}));
  }}
}finally{
  await context?.close();const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});
}
