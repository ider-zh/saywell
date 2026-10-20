// Explicit actual MV3 smoke test. A disposable profile sends only synthetic test-connection text.
import {chromium} from '@playwright/test';import {cp,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {HOSTED_AI_ENDPOINT} from '../src/core/hosted-ai.js';
const root=await mkdtemp(path.join(os.tmpdir(),'saywell-hosted-smoke-'));let context;
try{
  const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[new URL(HOSTED_AI_ENDPOINT).origin+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',locale:'en-US',headless:true,...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();
  await worker.evaluate(()=>{const original=globalThis.fetch;globalThis.__hostedErrors=[];globalThis.fetch=async(...args)=>{const response=await original(...args);if(!response.ok){let code;try{code=(await response.clone().json()).error?.code;}catch{}globalThis.__hostedErrors.push({status:response.status,code});}return response;};});
  await ui.goto(`chrome-extension://${id}/settings.html`);
  await ui.locator('#test-llm').click();await ui.waitForFunction(()=>!document.querySelector('#test-llm').disabled,{timeout:45000});
  console.log(JSON.stringify({status:await ui.locator('#status').textContent(),state:await ui.evaluate(async()=>{const {data}=await chrome.runtime.sendMessage({type:'state'});return {provider:data.settings.llm.provider,enabled:data.settings.llm.enabled,consent:data.settings.llm.consent,hasKey:data.hasKeys.llm};})}));
  console.log(JSON.stringify({httpErrors:await worker.evaluate(()=>globalThis.__hostedErrors)}));
}finally{await context?.close();const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});}
