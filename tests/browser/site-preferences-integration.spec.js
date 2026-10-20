import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';

test('real MV3 website defaults route to a separate profile and MT engine without changing another host',async()=>{
  const requests=[];let context;
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;
    if(url.pathname==='/get'){
      requests.push({lane:'mt',engine:'mymemory',pair:url.searchParams.get('langpair')});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({responseStatus:200,responseData:{translatedText:'Machine translation.'}}));
    }else if(url.pathname==='/translate/translatetext'){
      requests.push({lane:'mt',engine:'microsoft',target:url.searchParams.get('to')});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify([{translations:[{text:'机器翻译。',to:'zh'}]}]));
    }else if(url.pathname==='/v1/chat/completions'){
      const body=JSON.parse(raw);requests.push({lane:'llm',body});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({text:body.model==='site-model'?'网站润色结果。':'Global phrasing.',vocabulary:[]})}}]}));
    }else{res.writeHead(200,{'content-type':'text/html'});res.end(await readFile('tests/browser/fixtures.html'));}
  });
  await new Promise(resolve=>server.listen(0,resolve));const port=server.address().port,base=`http://127.0.0.1:${port}`,other=`http://localhost:${port}`,root=await mkdtemp(path.join(os.tmpdir(),'saywell-site-preferences-'));
  try{
    const extension=path.join(root,'extension');await cp('dist',extension,{recursive:true});const manifest=JSON.parse(await readFile('manifest.json','utf8'));manifest.host_permissions=[base+'/*',other+'/*'];await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,ui=await context.newPage();await ui.goto(`chrome-extension://${id}/settings.html`);
    const configured=await ui.evaluate(async({base,other})=>{
      const {data}=await chrome.runtime.sendMessage({type:'state'}),s=data.settings;
      s.siteOrigins=[base+'/*',other+'/*'];s.debounce=400;s.mode='auto';s.targetLanguage='en';s.basicEngine='mymemory';s.basicFallback=false;
      s.basic.mymemory={consent:true,endpoint:base};s.basic.microsoft={consent:true,endpoint:base};
      const a={...s.llmProfiles[0],name:'Global',enabled:true,consent:true,provider:'ollama',endpoint:base+'/v1',model:'global-model'},b={...a,id:'writing',name:'Writing',model:'site-model'};
      s.llmProfiles=[a,b];const {id,name,...config}=a;s.llm=config;s.activeLlmId=a.id;
      return chrome.runtime.sendMessage({type:'save-settings',settings:s});
    },{base,other});expect(configured.ok).toBe(true);
    const p=await context.newPage();await p.goto(base);const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
    await draft.fill('先测试全局默认配置。');await expect(tip.locator('.suggestion')).toHaveText('Global phrasing.');await expect(tip.getByText('Not on blacklist',{exact:true})).toHaveCount(0);await tip.locator('.site-policy>summary').click();
    await tip.getByLabel('Website default action',{exact:true}).selectOption('polish');await tip.getByLabel('Website target language',{exact:true}).selectOption('zh');await tip.getByLabel('Website LLM configuration',{exact:true}).selectOption('writing');await tip.getByLabel('Website translation engine',{exact:true}).selectOption('microsoft');await tip.getByRole('button',{name:'Save for this website',exact:true}).click();
    await expect(tip.getByRole('status').last()).toContainText('Website settings saved.');
    const snapshot=await ui.evaluate(async()=>({...(await chrome.storage.local.get('sitePreferences')),settings:(await chrome.runtime.sendMessage({type:'state'})).data.settings}));
    expect(snapshot.sitePreferences['127.0.0.1']).toEqual({mode:'polish',targetLanguage:'zh',llmProfileId:'writing',basicEngine:'microsoft'});expect(snapshot.settings.activeLlmId).toBe('default');expect(snapshot.settings.targetLanguage).toBe('en');expect(snapshot.settings.mode).toBe('auto');
    const start=requests.length;await p.reload();await draft.fill('This are a synthetic sentence.');await expect(tip.locator('.suggestion')).toHaveText('网站润色结果。');
    const routed=requests.slice(start),llm=routed.find(r=>r.lane==='llm');expect(llm.body.model).toBe('site-model');expect(llm.body.messages[0].content).toContain('Action: polish');expect(llm.body.messages[0].content).toContain('Simplified Chinese');await expect.poll(()=>requests.slice(start).some(r=>r.engine==='microsoft' && r.target==='zh-CHS')).toBe(true);
    const otherPage=await context.newPage();await otherPage.goto(other);await otherPage.getByRole('textbox',{name:'Draft',exact:true}).fill('其他网站沿用全局配置。');await expect(otherPage.locator('input-coach-tip .suggestion')).toHaveText('Global phrasing.');expect(requests.at(-1).lane==='llm'?requests.at(-1).body.model:requests.filter(r=>r.lane==='llm').at(-1).body.model).toBe('global-model');
    await tip.locator('.site-policy>summary').click();await expect(tip.getByLabel('Website LLM configuration',{exact:true})).toHaveValue('writing');await tip.getByRole('button',{name:'Reset website settings',exact:true}).click();await expect(tip.getByRole('status').last()).toContainText('reset to global defaults');
    await draft.fill('恢复后再次使用全局配置。');await expect(tip.locator('.suggestion')).toHaveText('Global phrasing.');
    expect((await ui.evaluate(async()=>(await chrome.storage.local.get('sitePreferences')).sitePreferences))['127.0.0.1']).toBeUndefined();
  }finally{
    await context?.close();await new Promise(resolve=>server.close(resolve));const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});
  }
});
