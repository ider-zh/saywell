import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';

test('actual MV3 masks only LLM, renders stable safe tags, and restores Copy, Apply and history',async()=>{
  let context,releaseLLM,scenario='good';const calls=[];
  const llmGate=new Promise(resolve=>{releaseLLM=resolve;});
  const file='C:\\demo\\report.txt',email='dev@example.com',url='https://example.com/help';
  const source=`请检查 ${file}，发给 ${email}，参考 ${url}。`;
  const mt=`Check ${file}; email ${email}; see ${url}.`,polished=`Please check ${file} and email ${email}. See ${url}.`;
  const server=createServer(async(req,res)=>{
    const u=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;
    if(u.pathname==='/get'){
      calls.push({lane:'mt',text:u.searchParams.get('q')});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:mt}}));
    }else if(u.pathname==='/v1/chat/completions'){
      const body=JSON.parse(raw),text=JSON.parse(body.messages[1].content).text;calls.push({lane:'llm',text});
      const tokens=text.match(/__SWP_[a-f0-9]+_[A-Z]+_\d+__/g);if(scenario==='good')await llmGate;
      const value={text:scenario==='bad'?'Missing every protected value.':`Please check ${tokens[0]} and email ${tokens[1]}. See ${tokens[2]}.`,vocabulary:[{word:'check',meaning:'检查',example:`Please check ${tokens[0]}.`}]};
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}));
    }else{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile('tests/browser/fixtures.html'));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-protected-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',headless:true,locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    const saved=await ui.evaluate(async base=>{const {data}=await chrome.runtime.sendMessage({type:'state'}),s=data.settings;s.siteOrigins=[base+'/*'];s.debounce=400;s.basicEngine='mymemory';s.basicFallback=false;s.basic.mymemory={consent:true,endpoint:base};s.llm={...s.llm,provider:'ollama',enabled:true,consent:true,endpoint:base+'/v1',model:'synthetic'};await chrome.storage.local.set({uiLanguage:'en'});return chrome.runtime.sendMessage({type:'save-settings',settings:s});},base);expect(saved.ok).toBe(true);
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});const page=await context.newPage();await page.goto(base);const draft=page.getByRole('textbox',{name:'Draft',exact:true}),tip=page.locator('input-coach-tip'),sentence=tip.locator('.suggestion');await draft.fill(source);
    await expect(sentence.locator('.special-token')).toHaveCount(3);await expect(tip.locator('.engine')).toContainText('MyMemory');
    expect(calls.find(c=>c.lane==='mt').text).toBe(source);await expect.poll(()=>calls.filter(c=>c.lane==='llm').length).toBe(1);for(const value of [file,email,url])expect(calls.find(c=>c.lane==='llm').text).not.toContain(value);
    await expect(sentence.locator('.special-value').first()).toBeHidden();await sentence.getByRole('button',{name:'File path 1',exact:true}).click();await expect(sentence.locator('.special-value').first()).toHaveText(file);await expect(sentence.locator('.special-value').first()).toBeVisible();
    await sentence.getByRole('button',{name:'Copy original',exact:true}).first().click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(file);
    releaseLLM();await page.waitForTimeout(150);await expect(tip.locator('.engine')).toContainText('MyMemory');
    await sentence.getByRole('button',{name:'File path 1',exact:true}).click();await expect(tip.locator('.engine')).toContainText('Ollama');await expect(sentence.locator('.special-token')).toHaveCount(3);await expect(tip.locator('.mt-text')).toBeHidden();
    const visible=await sentence.innerText();for(const value of [file,email,url,'__SWP_'])expect(visible).not.toContain(value);await expect(sentence.getByRole('button',{name:'check',exact:true})).toBeVisible();
    await sentence.getByRole('button',{name:'check',exact:true}).click();await tip.getByRole('button',{name:'Save for review',exact:true}).click();
    const vocabulary=await ui.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.vocabulary);expect(vocabulary[0].example).toBe('');expect(vocabulary[0].context).toBeUndefined();expect(JSON.stringify(vocabulary)).not.toContain(file);
    await expect(tip.locator('a')).toHaveCount(0);await page.mouse.move(1100,800);await page.screenshot({path:'test-results/protected-content-en.png'});
    await tip.getByRole('button',{name:'Copy',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(polished);
    await tip.getByRole('button',{name:'Apply ↗',exact:true}).click();await expect(draft).toHaveValue(polished);
    const history=await ui.evaluate(async()=>(await chrome.runtime.sendMessage({type:'get-history'})).data.records);expect(JSON.stringify(history)).not.toContain('__SWP_');expect(history.some(row=>row.source===source && row.results.llm?.text===polished)).toBe(true);
    await ui.evaluate(()=>chrome.storage.local.set({uiLanguage:'zh-CN'}));await draft.fill('再次'+source);await expect(sentence.getByRole('button',{name:'文件路径 1',exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});await sentence.getByRole('button',{name:'文件路径 1',exact:true}).click();await expect(sentence.locator('.special-value').first()).toBeVisible();await page.screenshot({path:'test-results/protected-content-zh.png'});await sentence.getByRole('button',{name:'文件路径 1',exact:true}).click();
    scenario='bad';const before=calls.length;await draft.fill('错误样例'+source);await expect(tip.locator('.parallel-results')).toContainText('大模型未能完整保留特殊内容');await expect(tip.locator('.engine')).toContainText('MyMemory');expect(calls.length-before).toBe(2);expect(await tip.innerText()).not.toContain('__SWP_');await expect(draft).toHaveValue('错误样例'+source);
  }finally{releaseLLM();await context?.close();await new Promise(resolve=>server.close(resolve));const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});}
});
