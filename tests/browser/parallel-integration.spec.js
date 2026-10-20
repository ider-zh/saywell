import {test,expect,chromium} from '@playwright/test';import {createServer} from 'node:http';import {readFile,mkdtemp,cp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';

test('real MV3 starts MT and LLM together, forwards target/thinking, and keeps late MT collapsed',async()=>{
  let context,releaseLLM,releaseMT,signalLLM;let scenario='mt-first';const requests=[];
  let llmGate=new Promise(resolve=>{releaseLLM=resolve;}),mtGate=new Promise(resolve=>{releaseMT=resolve;}),llmStarted=new Promise(resolve=>{signalLLM=resolve;});
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;
    if(url.pathname==='/get'){
      requests.push({lane:'mt',pair:url.searchParams.get('langpair')});await llmStarted;if(scenario==='llm-first')await mtGate;
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:scenario==='mt-first'?'Machine translation.':'机器翻译。'}}));
    }else if(url.pathname==='/v1/chat/completions'){
      requests.push({lane:'llm',body:JSON.parse(raw)});signalLLM();if(scenario==='mt-first')await llmGate;
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({text:scenario==='mt-first'?'Refined translation.':'润色后的中文。',vocabulary:[]})}}]}));
    }else{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile('tests/browser/fixtures.html'));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'input-coach-parallel-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    const configure=async targetLanguage=>{
      const reply=await ui.evaluate(async({base,targetLanguage})=>{
        const r=await chrome.runtime.sendMessage({type:'state'}),s=r.data.settings;s.siteOrigins=[base+'/*'];s.targetLanguage=targetLanguage;s.debounce=400;s.basicEngine='mymemory';s.basicFallback=false;s.basic.mymemory={consent:true,endpoint:base};s.llm={...s.llm,enabled:true,consent:true,provider:'ollama',model:'fixture',endpoint:base+'/v1'};return chrome.runtime.sendMessage({type:'save-settings',settings:s});
      },{base,targetLanguage});expect(reply.ok).toBe(true);
    };
    await configure('en');const page=await context.newPage();await page.goto(base);const draft=page.getByRole('textbox',{name:'Draft',exact:true}),tip=page.locator('input-coach-tip');await draft.fill('请翻译这句话。');await expect(tip.locator('.suggestion')).toHaveText('Machine translation.');
    expect(requests.map(r=>r.lane).sort()).toEqual(['llm','mt']);expect(requests.find(r=>r.lane==='llm').body.reasoning_effort).toBe('none');await expect(draft).toHaveValue('请翻译这句话。');releaseLLM();await expect(tip.locator('.suggestion')).toHaveText('Refined translation.');await expect(tip.locator('.mt-text')).toBeHidden();
    scenario='llm-first';requests.length=0;llmStarted=new Promise(resolve=>{signalLLM=resolve;});await configure('zh');await draft.fill('Please translate this sentence.');await expect(tip.locator('.suggestion')).toHaveText('润色后的中文。');await expect(tip.locator('.mt-result')).toHaveCount(0);
    expect(requests.find(r=>r.lane==='mt').pair).toBe('en|zh-CN');expect(requests.find(r=>r.lane==='llm').body.messages[0].content).toContain('Target language: Simplified Chinese');releaseMT();await expect(tip.locator('.mt-result')).toBeAttached();await expect(tip.locator('.mt-text')).toBeHidden();await expect(tip.locator('.suggestion')).toHaveText('润色后的中文。');
  }finally{releaseLLM();releaseMT();signalLLM();await context?.close();await new Promise(resolve=>server.close(resolve));const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});}
});
