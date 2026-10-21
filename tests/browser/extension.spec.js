import {test,expect,chromium} from '@playwright/test';
import {mergeSettings} from '../../src/core/settings.js';
import {HOSTED_AI_ENDPOINT,LEGACY_HOSTED_AI_ENDPOINT} from '../../src/core/hosted-ai.js';
import {createServer} from 'node:http';import {readFile,mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
let context,extensionId,server,base,profile,worker;
test.beforeAll(async()=>{
  server=createServer(async(req,res)=>{const name=req.url.startsWith('/styles.css')?'dist/styles.css':req.url.startsWith('/dashboard.js')?'dist/dashboard.js':req.url.startsWith('/settings.js')?'dist/settings.js':req.url.startsWith('/vocabulary.js')?'dist/vocabulary.js':req.url.startsWith('/popup.js')?'dist/popup.js':req.url==='/dashboard.html'?'dist/dashboard.html':req.url==='/settings.html'?'dist/settings.html':'tests/browser/fixtures.html';res.writeHead(200,{'content-type':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});res.end(await readFile(name));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  profile=await mkdtemp(path.join(os.tmpdir(),'input-coach-test-'));const extensionPath=path.resolve('dist');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',locale:'en-US',...(process.env.INPUT_COACH_BROWSER?{executablePath:process.env.INPUT_COACH_BROWSER}:{}),headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');extensionId=new URL(worker.url()).host;
});
test.afterAll(async()=>{await context?.close();await new Promise(resolve=>server.close(resolve));await rm(profile,{recursive:true,force:true});});
async function pageWithCoach(){
  const p=await context.newPage();await p.goto(base);
  await p.addScriptTag({path:path.resolve('tests/browser/mock-runtime.js')});
  await p.addScriptTag({path:path.resolve('dist/content.js')});return p;
}
// Production browser extension pages and worker run normally. The fixture content runtime
// bridges messages explicitly because optional host grants cannot be auto-approved by headless Chromium.

test('sentence practice focuses locally, prioritizes character differences, keeps IME text and survives a late AI response',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={mt:40,llm:1800};});
  const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');await draft.fill('这是练习用的句子。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');
  await tip.getByRole('button',{name:'Practice this sentence',exact:true}).click();const input=tip.getByRole('textbox',{name:'Retype the suggested sentence'});await expect(input).toBeFocused();
  await input.fill('hello world!');await expect(tip.locator('.practice-panel')).toHaveAttribute('data-complete','true');await expect(tip.locator('.practice-mirror .practice-major')).toHaveCount(0);await expect(tip.locator('.practice-mirror .practice-minor')).not.toHaveCount(0);
  await input.fill('Hello, word.');await expect(tip.locator('.practice-panel')).toHaveAttribute('data-complete','false');await expect(tip.locator('.practice-target .practice-major')).toHaveText('l');
  await input.evaluate(input=>{input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true}));input.value='你';input.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,isComposing:true}));});await expect(input).toHaveValue('你');
  await input.evaluate(input=>input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:'你'})));await expect(tip.locator('.practice-mirror')).toHaveText('你\n');
  await input.fill('Hello, world.');await expect(tip.locator('.practice-panel')).toHaveAttribute('data-complete','true');await p.waitForTimeout(1900);await expect(input).toBeFocused();await expect(input).toHaveValue('Hello, world.');await expect(tip.locator('.practice-target')).toHaveText('Hello, world.');
  expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(2);const metrics=await p.evaluate(()=>window.__coachMetrics);expect(metrics.reduce((sum,row)=>sum+(row.typed || 0),0)).toBe(9);expect(metrics.reduce((sum,row)=>sum+(row.accepted || 0),0)).toBe(0);await expect(draft).toHaveValue('这是练习用的句子。');
  await input.fill('Hello, worxld!');await tip.screenshot({path:'test-results/practice-mt-en.png'});await input.press('Escape');await expect(tip.locator('.practice-panel')).toHaveCount(0);await expect(tip.locator('.suggestion')).toHaveText('We should streamline this process.');
  await tip.getByRole('button',{name:'Practice this sentence',exact:true}).click();await expect(input).toBeFocused();await input.fill('We should streamline this process.');await expect(tip.locator('.practice-panel')).toHaveAttribute('data-complete','true');await tip.getByRole('button',{name:'Start again'}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();
  await input.press('Escape');await p.evaluate(()=>window.__coachSetSettings({uiLanguage:'zh-CN'}));await draft.fill('再试一次中文练习。');await expect(tip.locator('.suggestion')).toHaveText('We should streamline this process.');await tip.getByRole('button',{name:'练习这句话',exact:true}).click();const chineseInput=tip.getByRole('textbox',{name:'重新输入建议句子',exact:true});await expect(chineseInput).toBeFocused();await chineseInput.fill('We should streamline this process.');await p.setViewportSize({width:360,height:640});await expect(tip.locator('.practice-panel')).toHaveAttribute('data-complete','true');await tip.screenshot({path:'test-results/practice-zh.png'});await p.close();
});

test('mini pause entry keeps late results from replacing choices and sends the selected site/all duration',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true,uiLanguage:'zh-CN'});window.__coachDelays={mt:30,llm:1100};});
  await p.getByRole('textbox',{name:'Draft',exact:true}).fill('这是临时暂停测试。');const tip=p.locator('input-coach-tip');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');
  await tip.getByRole('button',{name:'临时暂停',exact:true}).click();await tip.getByLabel('暂停时长',{exact:true}).selectOption('tomorrow');await tip.getByLabel('暂停范围',{exact:true}).selectOption('all');await p.waitForTimeout(1200);
  await expect(tip.getByLabel('暂停时长',{exact:true})).toHaveValue('tomorrow');await expect(tip.getByLabel('暂停范围',{exact:true})).toHaveValue('all');await tip.screenshot({path:'test-results/snooze-menu-zh.png'});await tip.getByRole('button',{name:'暂停',exact:true}).click();await expect(tip).toHaveCount(0);
  expect(await p.evaluate(()=>window.__coachSnooze)).toMatchObject({scope:'all',duration:'tomorrow'});await p.getByRole('textbox',{name:'Draft',exact:true}).fill('暂停后不再请求。');await p.waitForTimeout(1100);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(2);await p.close();
});
test('website settings save action, target and providers, survive reload, and reset without changing global defaults',async()=>{
  const p=await pageWithCoach();
  const configure=()=>p.evaluate(()=>window.__coachSetSettings({llmChoices:[{id:'default',name:'Global',provider:'compatible',model:'global',enabled:false,consent:false},{id:'work',name:'Writing',provider:'mimo',model:'site-model',enabled:true,consent:true}]}));await configure();
  const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('这是一个网站设置测试。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');
  await expect(tip.getByText('Not on blacklist',{exact:true})).toHaveCount(0);await expect(tip.getByText('On blacklist',{exact:true})).toHaveCount(0);
  await expect(tip.getByText('Website settings',{exact:true})).toBeVisible();await tip.locator('.site-policy>summary').click();
  await tip.getByLabel('Website default action',{exact:true}).selectOption('polish');await tip.getByLabel('Website target language',{exact:true}).selectOption('zh');
  await tip.getByLabel('Website LLM configuration',{exact:true}).selectOption('work');await tip.getByLabel('Website translation engine',{exact:true}).selectOption('microsoft');
  expect(await p.evaluate(()=>window.__coachSiteSaves.length)).toBe(0);await tip.getByRole('button',{name:'Save for this website',exact:true}).click();
  await expect(tip.getByRole('status').last()).toHaveText('Website settings saved. Used from the next suggestion.');await expect(tip.getByRole('button',{name:'Apply ↗',exact:true})).toHaveCount(0);
  expect(await p.evaluate(()=>window.__coachSiteSaves.at(-1))).toEqual({mode:'polish',targetLanguage:'zh',llmProfileId:'work',basicEngine:'microsoft'});
  const current=await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'public-settings'})).data);expect(current.globalDefaults).toMatchObject({mode:'auto',targetLanguage:'en',basicEngine:'mymemory',activeLlmId:'default'});expect(current.llmEnabled).toBe(true);
  await p.evaluate(()=>{window.__coachResponses={llm:{text:'网站专属结果。',engine:'Site LLM',category:'llm',vocabulary:[]}};});
  await draft.fill('A new synthetic sentence.');await expect(tip.locator('.suggestion')).toHaveText('网站专属结果。');await expect(tip.getByLabel('Suggestion action')).toHaveValue('polish');await expect(draft).toHaveValue('A new synthetic sentence.');
  expect(await p.evaluate(()=>window.__coachRequests.at(-1).mode)).toBe('polish');
  await p.reload();await p.addScriptTag({path:path.resolve('tests/browser/mock-runtime.js')});await configure();await p.addScriptTag({path:path.resolve('dist/content.js')});
  await draft.fill('A sentence after reloading.');await expect(tip).toBeVisible();await tip.locator('.site-policy>summary').click();
  await expect(tip.getByLabel('Website target language',{exact:true})).toHaveValue('zh');await expect(tip.getByLabel('Website LLM configuration',{exact:true})).toHaveValue('work');
  await tip.screenshot({path:'test-results/website-settings-en.png'});
  await p.evaluate(()=>window.__coachSetSettings({uiLanguage:'zh-CN'}));await expect(tip.getByText('网站设置',{exact:true})).toBeVisible();
  await p.setViewportSize({width:390,height:700});await expect(tip.getByLabel('此网站默认操作',{exact:true})).toBeVisible();
  await expect.poll(async()=>{const b=await tip.boundingBox();return b.x>=11.5 && b.x+b.width<=378.5;}).toBe(true);await tip.screenshot({path:'test-results/website-settings-zh.png'});
  await tip.getByRole('button',{name:'恢复全局设置',exact:true}).click();await expect(tip.getByRole('status').last()).toHaveText('已恢复此网站的全局默认设置。');
  await expect(tip.getByLabel('此网站默认操作',{exact:true})).toHaveValue('@global');await expect(tip.getByLabel('此网站大模型配置',{exact:true})).toHaveValue('@global');
  expect((await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'public-settings'})).data)).targetLanguage).toBe('en');await p.close();
});

test('Apply waits for the frame to receive refreshed policy after a settings notification',async()=>{
  const p=await pageWithCoach(),draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('配置同步时不应用旧建议。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');
  await p.evaluate(()=>{
    const original=chrome.runtime.sendMessage;
    chrome.runtime.sendMessage=async message=>{
      if(message.type==='public-settings'){
        await new Promise(resolve=>{window.__releaseSettings=resolve;});const reply=await original(message);return {...reply,data:{...reply.data,enabled:false}};
      }
      return original(message);
    };
    window.__coachRefreshSettings();
  });
  await tip.getByRole('button',{name:'Apply ↗',exact:true}).click();await expect(draft).toHaveValue('配置同步时不应用旧建议。');
  await p.evaluate(()=>window.__releaseSettings());await expect(tip).toHaveCount(0);await expect(draft).toHaveValue('配置同步时不应用旧建议。');await p.close();
});

test('late LLM results preserve website editing and saving invalidates old Apply and results',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={llm:1600,mt:0};});
  const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');await draft.fill('请测试并行中的网站设置。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');
  await tip.locator('.site-policy>summary').click();const action=tip.getByLabel('Website default action',{exact:true});await action.focus();await p.waitForTimeout(1900);
  await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');await action.selectOption('polish');
  await tip.getByRole('button',{name:'Copy',exact:true}).click();await expect(tip.locator('.suggestion')).toHaveText('We should streamline this process.');await expect(action).toHaveValue('polish');
  expect(await tip.locator('.site-policy').evaluate(e=>e.open)).toBe(true);expect(await p.evaluate(()=>window.__coachSiteSaves.length)).toBe(0);
  await tip.getByRole('button',{name:'Save for this website',exact:true}).click();await expect(tip.getByRole('status').last()).toContainText('Website settings saved.');
  await draft.fill('另一个尚未结束的翻译。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');await tip.locator('.site-policy>summary').click();
  await tip.getByLabel('Website target language',{exact:true}).selectOption('zh');await tip.getByRole('button',{name:'Save for this website',exact:true}).click();
  await expect(tip.getByRole('button',{name:'Apply ↗',exact:true})).toHaveCount(0);await p.waitForTimeout(1900);await expect(tip.locator('.suggestion')).toHaveCount(0);await expect(draft).toHaveValue('另一个尚未结束的翻译。');
  await p.close();
});

test('tooltip drag survives late LLM replacement, scrolling, reload, resize and reset',async()=>{
  const p=await pageWithCoach();await p.setViewportSize({width:1280,height:900});
  await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={llm:2000,mt:0};});
  const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('你好，世界。');await expect(tip.getByText('Hello, world.',{exact:true})).toBeVisible();
  const pin=tip.locator('.position-reset');await expect(pin).toBeHidden();await expect(pin).toHaveAttribute('aria-pressed','false');
  const handle=tip.getByRole('button',{name:'Move tooltip',exact:true}),start=await handle.boundingBox();
  await p.mouse.move(start.x+35,start.y+10);await p.mouse.down();await p.mouse.move(850,90,{steps:8});await p.mouse.up();
  await expect.poll(()=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('coach-tooltip-position') || 'null')?.x || 0)).toBeGreaterThan(0.7);
  const dragged=await tip.boundingBox();expect(dragged.x).toBeGreaterThan(700);
  await expect(pin).toBeVisible();await expect(pin).toHaveAttribute('aria-pressed','true');await expect(tip).toHaveAttribute('data-position-pinned','');
  await expect(pin).toHaveAttribute('title','Position remembered for this website · Click to follow input');
  expect((await pin.locator('svg').boundingBox()).width).toBeLessThan(19);expect((await pin.boundingBox()).width).toBe(20);
  await tip.screenshot({path:'test-results/tooltip-pinned-en.png'});
  await expect(tip.locator('.suggestion')).toContainText('We should streamline this process.');
  expect(Math.abs((await tip.boundingBox()).x-dragged.x)).toBeLessThan(1);
  await expect(pin).toBeVisible();
  await p.evaluate(()=>{document.body.style.minHeight='2500px';window.scrollTo(0,500);});
  expect(Math.abs((await tip.boundingBox()).x-dragged.x)).toBeLessThan(1);
  const saved=await p.evaluate(()=>sessionStorage.getItem('coach-tooltip-position'));
  await p.reload();await p.addScriptTag({path:path.resolve('tests/browser/mock-runtime.js')});await p.addScriptTag({path:path.resolve('dist/content.js')});
  await draft.fill('你好，世界。');await expect(tip).toBeVisible();
  await expect(pin).toHaveAttribute('aria-pressed','true');await expect(pin).toBeVisible();
  expect(Math.abs((await tip.boundingBox()).x-dragged.x)).toBeLessThan(1);
  await p.setViewportSize({width:390,height:300});
  await expect.poll(async()=>{const b=await tip.boundingBox();return b.x>=11.5 && b.y>=11.5 && b.x+b.width<=378.5 && b.y+b.height<=288.5;}).toBe(true);
  expect(await p.evaluate(()=>sessionStorage.getItem('coach-tooltip-position'))).toBe(saved);
  await p.setViewportSize({width:1280,height:900});
  await expect.poll(async()=>Math.abs((await tip.boundingBox()).x-dragged.x)).toBeLessThan(1);
  await tip.getByRole('button',{name:'Reset tooltip position',exact:true}).click();
  await expect(pin).toBeHidden();await expect(tip).not.toHaveAttribute('data-position-pinned');
  await expect.poll(()=>p.evaluate(()=>sessionStorage.getItem('coach-tooltip-position'))).toBe('null');
  expect((await tip.boundingBox()).x).toBeLessThan(200);
  const requestCount=await p.evaluate(()=>window.__coachRequests.length);await p.evaluate(()=>window.scrollTo(0,40));
  await expect.poll(async()=>Math.abs((await tip.boundingBox()).x-(await draft.boundingBox()).x)).toBeLessThan(1);
  expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(requestCount);
  await tip.getByRole('button',{name:'Apply ↗',exact:true}).click();await expect(draft).toHaveValue('Hello, world.');await p.close();
});

test('tooltip supports keyboard movement and cancelled drag without changing the draft',async()=>{
  const p=await pageWithCoach(),draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('你好，世界。');await expect(tip).toBeVisible();
  const handle=tip.getByRole('button',{name:'Move tooltip',exact:true}),initial=await tip.boundingBox();
  await handle.focus();await handle.press('Shift+ArrowRight');
  await expect(tip.locator('.position-reset')).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>(await tip.boundingBox()).x).toBeCloseTo(initial.x+40,0);
  const saved=await p.evaluate(()=>sessionStorage.getItem('coach-tooltip-position')),before=await tip.boundingBox();
  const grip=await handle.boundingBox();await p.mouse.move(grip.x+20,grip.y+10);await p.mouse.down();await p.mouse.move(900,100,{steps:5});
  await handle.dispatchEvent('pointercancel',{pointerId:1});await p.mouse.up();
  await expect.poll(async()=>Math.abs((await tip.boundingBox()).x-before.x)).toBeLessThan(1);
  expect(await p.evaluate(()=>sessionStorage.getItem('coach-tooltip-position'))).toBe(saved);
  await p.evaluate(()=>window.__coachSetSettings({uiLanguage:'zh-CN'}));await draft.press('Alt+Shift+E');
  const pin=tip.getByRole('button',{name:'重置浮窗位置',exact:true});await expect(pin).toHaveAttribute('title','已记住此网站位置 · 点击恢复自动定位');
  await tip.screenshot({path:'test-results/tooltip-pinned-zh.png'});
  await pin.focus();await pin.press('Enter');await expect(pin).toBeHidden();await expect(tip).not.toHaveAttribute('data-position-pinned');
  await expect.poll(()=>p.evaluate(()=>sessionStorage.getItem('coach-tooltip-position'))).toBe('null');
  await expect(draft).toHaveValue('你好，世界。');
  await tip.getByRole('button',{name:'Apply ↗',exact:true}).click();await expect(draft).toHaveValue('Hello, world.');await p.close();
});

test('extension settings render, validate defaults, and dashboard has an honest empty state',async()=>{
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`chrome-extension://${extensionId}/settings.html`);await expect(p.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
  await expect(p.locator('#basicEngine')).toHaveValue('auto');await expect(p.locator('#llm-remember')).not.toBeChecked();
  await expect(p.locator('#siteMode')).toHaveValue('blacklist');await expect(p.locator('#allowlist')).toBeDisabled();
  await p.locator('#siteMode').selectOption('whitelist');await expect(p.locator('#allowlist')).toBeEnabled();await p.locator('#allowlist').fill('kept.example');await p.locator('#siteMode').selectOption('blacklist');await expect(p.locator('#allowlist')).toHaveValue('kept.example');
  await expect(p.locator('#basicFallback')).toBeChecked();await expect(p.getByRole('button',{name:'Enable free translation',exact:true})).toBeVisible();
  await p.getByText('Fallback order & connectivity',{exact:true}).click();await expect(p.locator('#basic-order li')).toHaveCount(7);for(let i=0;i<3;i++)await p.getByRole('button',{name:'Move MyMemory up',exact:true}).click();await expect(p.locator('#basic-order li').first()).toContainText('MyMemory');
  await p.locator('#dailyGoal').fill('350');await p.getByRole('button',{name:'Save preferences'}).click();await expect(p.getByRole('status')).toContainText('Preferences saved');
  await p.goto(`chrome-extension://${extensionId}/dashboard.html`);await expect(p.locator('#goal-target')).toHaveText('350');await expect(p.locator('#english')).toHaveText('0');
  await p.getByRole('button',{name:'30 days',exact:true}).click();await expect(p.locator('.chart-column')).toHaveCount(30);
  await p.screenshot({path:'test-results/dashboard.png',fullPage:true});expect(errors).toEqual([]);await p.close();
});

test('console language follows browser, switches across pages, and preserves autosaved form and vocabulary',async()=>{
  const p=await context.newPage(),other=await context.newPage();
  await p.addInitScript(()=>{if(globalThis.chrome?.i18n)chrome.i18n.getUILanguage=()=>'zh-TW';});
  await p.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(p.locator('html')).toHaveAttribute('lang','zh-CN');await expect(p.getByRole('heading',{name:'设置',exact:true})).toBeVisible();
  await expect(p.locator('#ui-language')).toHaveValue('auto');await p.locator('#llm-provider').selectOption('compatible');await expect(p.locator('#llm-model')).toHaveAttribute('placeholder','请输入模型 ID');
  await p.locator('#llm-model').fill('unsaved-model');await p.locator('#llm-key').fill('unsaved-secret');
  await p.locator('#ui-language').selectOption('en');await expect(p.locator('html')).toHaveAttribute('lang','en');await expect(p.locator('#llm-model')).toHaveValue('unsaved-model');await expect(p.locator('#llm-key')).toHaveValue('unsaved-secret');
  await expect.poll(()=>worker.evaluate(async()=>(await chrome.storage.local.get('settings')).settings?.llm.model)).toBe('unsaved-model');
  const stored=await worker.evaluate(async()=>chrome.storage.local.get(['uiLanguage','settings','keys']));expect(stored.uiLanguage).toBe('en');expect(JSON.stringify(stored)).not.toContain('unsaved-secret');
  expect(await worker.evaluate(async()=>(await chrome.storage.session.get('keys')).keys?.llm)).toBe('unsaved-secret');
  await other.goto(`chrome-extension://${extensionId}/dashboard.html`);await expect(other.locator('html')).toHaveAttribute('lang','en');
  await p.locator('#ui-language').selectOption('zh-CN');await expect(other.locator('html')).toHaveAttribute('lang','zh-CN');await expect(other.getByRole('button',{name:'30 天',exact:true})).toBeVisible();
  await expect(p.getByRole('button',{name:'启用免费翻译',exact:true})).toBeVisible();await expect(p.locator('#basicFallback')).toBeChecked();
  await other.getByRole('button',{name:'30 天',exact:true}).click();await expect(other.locator('#period-total')).toHaveText('近 30 天 0 个单词');await expect(other.locator('#chart')).toHaveAttribute('aria-label','近 30 天：独立输入 0 个英文单词');
  await worker.evaluate(()=>chrome.storage.local.set({vocabulary:[{word:'Natural',meaning:'原始词义',explanation:'Keep original content.',status:'saved',date:'2026-10-20'}]}));
  await other.goto(`chrome-extension://${extensionId}/vocabulary.html`);await expect(other.getByRole('heading',{name:'Natural',exact:true})).toBeVisible();await expect(other.getByRole('button',{name:'标记为已掌握'})).toBeVisible();
  await other.goto(`chrome-extension://${extensionId}/popup.html`);await expect(other.locator('#setup-title')).toHaveText('需要网页访问授权');await expect(other.locator('#enabled')).toHaveAttribute('aria-label','启用翻译与建议');
  await expect(other.locator('#site-mode-popup')).toHaveValue('blacklist');await other.locator('#site-mode-popup').selectOption('whitelist');await expect(other.getByRole('status')).toHaveText('网站模式已保存。');
  await other.locator('#site-mode-popup').selectOption('blacklist');await expect(other.getByRole('status')).toHaveText('网站模式已保存。');
  await p.reload();await expect(p.locator('#ui-language')).toHaveValue('zh-CN');
  await p.locator('#ui-language').selectOption('auto');await expect(p.locator('html')).toHaveAttribute('lang','zh-CN');
  await p.locator('#llm-provider').selectOption('compatible');
  await p.locator('#ui-language').selectOption('en');await p.getByRole('button',{name:'Save preferences'}).click();await expect(p.getByRole('status')).toContainText('Preferences saved');
  await p.locator('#ui-language').selectOption('zh-CN');await expect(p.getByRole('status')).toHaveText('偏好已保存。');
  await expect(p.locator('#llm-provider')).toHaveValue('compatible');await expect(p.locator('#llm-endpoint')).toHaveValue('');
  await p.getByRole('button',{name:'连接并测试',exact:true}).first().click();await expect(p.getByRole('status')).toHaveText('请先填写 API 地址和模型，再连接服务。');
  await p.screenshot({path:'test-results/settings-zh.png',fullPage:true});
  await other.goto(`chrome-extension://${extensionId}/dashboard.html`);await other.screenshot({path:'test-results/dashboard-zh.png',fullPage:true});
  await other.setViewportSize({width:390,height:844});await expect(other.getByLabel('界面语言')).toBeVisible();expect(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await p.locator('#ui-language').selectOption('en');await expect(other.locator('html')).toHaveAttribute('lang','en');await p.close();await other.close();
});

test('MiMo and SiliconFlow presets localize hints, preserve model IDs, and reset unsaved credentials',async()=>{
  const p=await context.newPage();await p.goto(`chrome-extension://${extensionId}/settings.html`);
  await p.locator('#ui-language').selectOption('en');await p.locator('#llm-provider').selectOption('compatible');await p.locator('#llm-key').fill('synthetic-old-provider-key');
  await p.locator('#llm-provider').selectOption('mimo');await expect(p.locator('#llm-key')).toHaveValue('');
  await expect(p.locator('#llm-endpoint')).toHaveValue('https://api.xiaomimimo.com/v1');
  await expect(p.locator('#llm-model')).toHaveAttribute('placeholder','Example: mimo-v2.6-pro');
  await expect(p.locator('#llm-provider-help')).toContainText('Token Plan');await expect(p.locator('#llm-state')).toHaveText('Service not connected');
  await p.locator('#llm-provider').selectOption('siliconflow');await expect(p.locator('#llm-endpoint')).toHaveValue('https://api.siliconflow.cn/v1');
  await expect(p.locator('#llm-provider-help a').first()).toHaveAttribute('href','https://cloud.siliconflow.cn/me/models');
  await p.locator('#llm-model').fill('Pro/example/Text-Model');await p.locator('#ui-language').selectOption('zh-CN');
  await expect(p.locator('#llm-provider option:checked')).toHaveText('硅基流动 SiliconFlow');await expect(p.locator('#llm-provider-help')).toContainText('保留组织名称及 Pro/ 等前缀');
  await expect(p.locator('#llm-model')).toHaveValue('Pro/example/Text-Model');
  await p.getByRole('button',{name:'保存偏好 ↗',exact:true}).click();await expect(p.getByRole('status')).toHaveText('偏好已保存。');
  await p.reload();await expect(p.locator('#llm-provider')).toHaveValue('siliconflow');await expect(p.locator('#llm-model')).toHaveValue('Pro/example/Text-Model');
  await p.setViewportSize({width:390,height:844});expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await p.screenshot({path:'test-results/siliconflow-settings-zh.png',fullPage:true});
  await p.locator('#llm-provider').selectOption('mimo');await expect(p.locator('#llm-model')).toHaveValue('');await expect(p.locator('#llm-provider-help')).toContainText('默认关闭');
  await p.screenshot({path:'test-results/mimo-settings-zh.png',fullPage:true});
  await p.locator('#llm-provider').selectOption('compatible');await p.locator('#ui-language').selectOption('en');await p.getByRole('button',{name:'Save preferences ↗',exact:true}).click();await expect(p.getByRole('status')).toHaveText('Preferences saved.');await p.close();
});

test('synthetic input translates only after idle, Apply is explicit, paste and AI are separate',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined}));const draft=p.getByRole('textbox',{name:'Draft',exact:true});await draft.fill('你好，世界。');
  await expect(p.locator('input-coach-tip')).toBeVisible();await expect(p.locator('input-coach-tip').getByText('Hello, world.',{exact:true})).toBeVisible();await expect(draft).toHaveValue('你好，世界。');
  await p.locator('input-coach-tip').getByRole('button',{name:'Apply'}).click();await expect(draft).toHaveValue('Hello, world.');
  await p.waitForFunction(()=>window.__coachMetrics.some(d=>d.ai>0));
  const metrics=await p.evaluate(()=>window.__coachMetrics);expect(metrics.reduce((n,d)=>n+(d.ai||0),0)).toBe(13);expect(metrics.reduce((n,d)=>n+(d.accepted||0),0)).toBe(1);
  await p.close();
});

test('multiple LLM configurations retain separate models and keys; only explicit activation changes routing',async()=>{
  const p=await context.newPage();await p.goto(`chrome-extension://${extensionId}/settings.html`);
  await p.locator('#llm-profile-name').fill('Personal MiMo');await p.locator('#llm-provider').selectOption('mimo');await p.locator('#llm-model').fill('mimo-example');await p.locator('#llm-key').fill('synthetic-personal-key');
  await p.getByRole('button',{name:'Add configuration',exact:true}).click();await expect(p.locator('#llm-key')).toHaveValue('');
  const second=await p.locator('#llm-profile').inputValue();await p.locator('#llm-profile-name').fill('Work SiliconFlow');await p.locator('#llm-provider').selectOption('siliconflow');await p.locator('#llm-model').fill('Pro/example/Work');await p.locator('#llm-key').fill('synthetic-work-key');
  await p.getByRole('button',{name:'Save preferences ↗',exact:true}).click();await expect(p.getByRole('status')).toHaveText('Preferences saved.');
  await expect(p.locator('#active-llm-profile')).toHaveText('Active configuration: Personal MiMo');await expect(p.locator('#llm-profile')).toHaveValue(second);
  let stored=await worker.evaluate(()=>chrome.storage.session.get('keys'));expect(stored.keys.llm).toBe('synthetic-personal-key');expect(stored.keys['llm:'+second]).toBe('synthetic-work-key');
  await p.locator('#llm-profile').selectOption('default');await expect(p.locator('#llm-model')).toHaveValue('mimo-example');await expect(p.locator('#llm-key')).toHaveValue('');await expect(p.locator('#llm-key')).toHaveAttribute('placeholder','Key is set · leave blank to keep it');
  await p.locator('#llm-profile').selectOption(second);await p.getByRole('button',{name:'Activate configuration',exact:true}).click();await expect(p.locator('#active-llm-profile')).toHaveText('Active configuration: Work SiliconFlow');
  await expect(p.locator('#activate-llm-profile')).toBeDisabled();await p.locator('#llm').screenshot({path:'test-results/llm-profiles.png',animations:'disabled',style:'.save-bar{visibility:hidden}'});
  const popup=await context.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);await expect(popup.locator('#llm-profile-popup')).toHaveValue(second);await popup.locator('#llm-profile-popup').selectOption('default');await expect(popup.getByRole('status')).toHaveText('Active configuration saved.');
  await expect(p.locator('#active-llm-profile')).toHaveText('Active configuration: Personal MiMo');await expect(p.locator('#llm-profile')).toHaveValue(second);await expect(p.locator('#llm-model')).toHaveValue('Pro/example/Work');
  await p.reload();await expect(p.locator('#llm-profile')).toHaveValue('default');await p.locator('#llm-profile').selectOption(second);await p.getByRole('button',{name:'Remove configuration',exact:true}).click();await expect(p.getByRole('status')).toHaveText('Configuration removed.');
  stored=await worker.evaluate(()=>chrome.storage.session.get('keys'));expect(stored.keys['llm:'+second]).toBeUndefined();expect(stored.keys.llm).toBe('synthetic-personal-key');
  await p.locator('#llm-profile-name').fill('Default configuration');await p.locator('#llm-provider').selectOption('compatible');await p.getByRole('button',{name:'Save preferences ↗',exact:true}).click();await expect(p.getByRole('status')).toHaveText('Preferences saved.');await p.close();await popup.close();
});

test('Apply supports plain ProseMirror, Draft.js, Slate and textarea composers, including keyboard activation',async()=>{
  const p=await pageWithCoach();
  await p.evaluate(()=>{
    document.querySelector('[aria-label="Plain editor"]').outerHTML='<div contenteditable="true" class="ProseMirror" role="textbox" aria-label="Chat composer"><p>你好，世界。</p></div><div contenteditable="true" class="public-DraftEditor-content" role="textbox" aria-label="Post composer"><div data-contents="true"><div data-block="true" data-editor="fixture" data-offset-key="a"><div class="public-DraftStyleDefault-block"><span data-offset-key="a"><span data-text="true">你好，世界。</span></span></div></div></div></div>';
    const slate=document.createElement('div');slate.setAttribute('contenteditable','true');slate.setAttribute('data-slate-editor','true');slate.setAttribute('role','textbox');slate.setAttribute('aria-label','Slate composer');slate.innerHTML='<div data-slate-node="element" style="position:relative"><span data-slate-node="text"><span data-slate-leaf="true" style="padding:5px 0"><span data-slate-string="true">你好，世界。</span></span></span></div>';document.body.append(slate);
    // Model-owned paste handler and selection normalization mirror the host editor boundary.
    document.addEventListener('selectionchange',()=>{const selection=getSelection();if(selection.rangeCount && selection.anchorNode===slate){const text=slate.querySelector('[data-slate-string]').firstChild;selection.setBaseAndExtent(text,0,text,text.length);}});
    slate.addEventListener('paste',event=>{event.preventDefault();window.__slateModel=event.clipboardData.getData('text/plain');slate.querySelector('[data-slate-string]').textContent=window.__slateModel;});
  });
  const tip=p.locator('input-coach-tip');
  for(const name of ['Chat composer','Post composer','Slate composer','Draft']){
    const editor=p.getByRole('textbox',{name,exact:true});if(name==='Draft')await editor.fill('你好，世界。');else{await editor.focus();await editor.press('Alt+Shift+E');}
    await expect(tip.getByRole('button',{name:'Apply'})).toBeEnabled();
    if(name==='Chat composer')await tip.screenshot({path:'test-results/tooltip-compact.png',animations:'disabled'});
    if(name==='Post composer'){await tip.getByRole('button',{name:'Apply'}).focus();await p.keyboard.press('Enter');}else await tip.getByRole('button',{name:'Apply'}).click();
    if(name==='Draft')await expect(editor).toHaveValue('Hello, world.');else await expect(editor).toHaveText('Hello, world.');
    await expect(tip).toHaveCount(0);
  }
  expect(await p.evaluate(()=>window.__slateModel)).toBe('Hello, world.');
  await expect.poll(async()=>(await p.evaluate(()=>window.__coachMetrics)).reduce((n,d)=>n+(d.accepted||0),0)).toBe(4);
  await p.close();
});

test('Slate replacement rejects edits during selection synchronization and never overwrites a newer draft',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{
    const editor=document.createElement('div');editor.setAttribute('contenteditable','true');editor.setAttribute('data-slate-editor','true');editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Slate race');editor.innerHTML='<div data-slate-node="element"><span data-slate-string="true">你好，世界。</span></div>';document.body.append(editor);
    editor.addEventListener('paste',()=>{window.__unexpectedPaste=true;});
    document.addEventListener('selectionchange',()=>{if(getSelection().anchorNode===editor)setTimeout(()=>{editor.querySelector('[data-slate-string]').textContent='A newer draft.';},20);});
  });
  const editor=p.getByRole('textbox',{name:'Slate race'});await editor.focus();await editor.press('Alt+Shift+E');const tip=p.locator('input-coach-tip');await tip.getByRole('button',{name:'Apply'}).click();
  await expect(editor).toHaveText('A newer draft.');expect(await p.evaluate(()=>Boolean(window.__unexpectedPaste))).toBe(false);await p.close();
});

test('Slate beforeinput model updates trigger suggestions when the host prevents native input events',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{
    const editor=document.createElement('div');editor.setAttribute('contenteditable','true');editor.setAttribute('data-slate-editor','true');editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Slate input');editor.innerHTML='<div data-slate-node="element"><span data-slate-zero-width="z">\uFEFF<br></span></div>';document.body.append(editor);
    editor.addEventListener('beforeinput',event=>{event.preventDefault();const span=document.createElement('span');span.setAttribute('data-slate-string','true');span.textContent=event.data;editor.firstChild.replaceChildren(span);});
  });
  await p.getByRole('textbox',{name:'Slate input'}).focus();await p.keyboard.insertText('你好，世界。');await expect(p.locator('input-coach-tip').getByText('Hello, world.',{exact:true})).toBeVisible();
  expect(await p.evaluate(()=>window.__coachRequests.map(r=>r.text))).toEqual(['你好，世界。']);await p.close();
});
test('IME composition makes no requests until commit; editing invalidates stale replies',async()=>{
  const p=await pageWithCoach();const draft=p.getByRole('textbox',{name:'Draft',exact:true});await draft.focus();
  await draft.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='你好';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'你',inputType:'insertCompositionText'}));});
  await p.waitForTimeout(1200);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(0);
  await draft.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你好'}));});
  await expect(p.locator('input-coach-tip').getByText('Hello, world.',{exact:true})).toBeVisible();
  await p.evaluate(()=>{window.__coachDelay=700;});await draft.fill('新的句子。');await p.waitForFunction(()=>window.__coachRequests.length===2);await draft.fill('Changed before reply');
  await p.waitForTimeout(800);await expect(p.locator('input-coach-tip')).toHaveCount(0);await p.close();
});
test('trusted IME composition counts committed Chinese once and excludes cancelled candidates',async()=>{
  const p=await pageWithCoach(),cdp=await context.newCDPSession(p);
  await p.evaluate(()=>window.__coachSetSettings({autoSuggest:false}));
  await p.evaluate(()=>{window.__imeEvents=[];for(const type of ['beforeinput','input','compositionstart','compositionend','compositionupdate'])document.addEventListener(type,e=>window.__imeEvents.push({type:e.type,data:e.data,value:e.target.value,trust:e.isTrusted,inputType:e.inputType,composing:e.isComposing}),true);});
  const draft=p.getByRole('textbox',{name:'Draft',exact:true});await draft.focus();
  await cdp.send('Input.imeSetComposition',{text:'nihao',selectionStart:5,selectionEnd:5});
  await cdp.send('Input.imeSetComposition',{text:'你好',selectionStart:2,selectionEnd:2});
  await cdp.send('Input.insertText',{text:'你好'});
  await expect(draft).toHaveValue('你好');
  await p.waitForTimeout(1800);
  expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.chinese,0)),JSON.stringify(await p.evaluate(()=>window.__imeEvents))).toBe(2);
  expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.typed,0))).toBe(2);
  expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.english,0))).toBe(0);
  await cdp.send('Input.imeSetComposition',{text:'quxiao',selectionStart:6,selectionEnd:6});
  await cdp.send('Input.imeSetComposition',{text:'',selectionStart:0,selectionEnd:0});
  await p.waitForTimeout(1800);expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.chinese,0))).toBe(2);
  const rich=p.getByRole('textbox',{name:'Rich editor'});await rich.focus();
  await cdp.send('Input.imeSetComposition',{text:'shijie',selectionStart:6,selectionEnd:6});await cdp.send('Input.insertText',{text:'世界'});
  await expect(rich).toHaveText('世界');await expect.poll(()=>p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.chinese,0))).toBe(4);
  expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.typed,0))).toBe(4);expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.english,0))).toBe(0);
  await rich.evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.textContent+='虚构';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'虚构',inputType:'insertCompositionText'}));e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'虚构'}));});
  await p.waitForTimeout(1800);expect(await p.evaluate(()=>window.__coachMetrics.reduce((n,d)=>n+d.chinese,0))).toBe(4);
  await cdp.detach();await p.close();
});
test('English polishing, vocabulary consent, hostile text and rich editor Copy fallback',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>window.__coachSetSettings({llmEnabled:true}));const draft=p.getByRole('textbox',{name:'Draft',exact:true});
  await draft.fill('We should make this process more simple.');await expect(p.locator('input-coach-tip').getByRole('button',{name:'streamline',exact:true})).toBeVisible();
  const tip=p.locator('input-coach-tip');await tip.getByRole('button',{name:'streamline',exact:true}).click();await tip.getByRole('button',{name:'Save for review',exact:true}).click();expect(await p.evaluate(()=>window.__coachWords[0].includeContext)).toBe(false);
  await tip.getByRole('button',{name:'Dismiss suggestion'}).click();await p.evaluate(()=>{window.__coachResponse={text:'<img src=x onerror=alert(1)>',engine:'Test',category:'llm',vocabulary:[]};});await draft.fill('Test hostile result.');await expect(tip.getByText('<img src=x onerror=alert(1)>',{exact:true})).toBeVisible();expect(await tip.locator('img').count()).toBe(0);
  await tip.getByRole('button',{name:'Dismiss suggestion'}).click();const rich=p.getByRole('textbox',{name:'Rich editor'});await rich.fill('你好，世界。');await rich.evaluate(e=>{const strong=document.createElement('strong');strong.textContent=e.textContent;e.replaceChildren(strong);});await rich.press('Alt+Shift+E');await expect(tip.getByRole('button',{name:'Apply'})).toBeDisabled();await expect(tip.getByText('This editor needs Copy. Your text stays in place.')).toBeVisible();await p.close();
});
test('pause and site exclusions stop processing; secret fields never trigger',async()=>{
  const p=await pageWithCoach();const draft=p.getByRole('textbox',{name:'Draft',exact:true});await p.evaluate(()=>window.__coachSetSettings({enabled:false}));await draft.fill('你好，世界。');await p.waitForTimeout(1100);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(0);
  await p.evaluate(()=>window.__coachSetSettings({enabled:true,blocklist:[location.hostname]}));await draft.fill('另一个句子。');await p.waitForTimeout(1100);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(0);
  await p.evaluate(()=>window.__coachSetSettings({blocklist:[]}));await p.getByRole('textbox',{name:'Password'}).fill('秘密内容');await p.waitForTimeout(1100);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(0);await p.close();
});
test('blacklist controls stop requests, support manual undo, and keep wildcard rules intact',async()=>{
  const p=await pageWithCoach();const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');await draft.fill('你好，世界。');
  await expect(tip.getByText('Not on blacklist',{exact:true})).toHaveCount(0);await expect(tip.getByRole('button',{name:'Add this site to blacklist',exact:true})).toBeHidden();expect(await tip.locator('.site-policy').evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(40);await tip.locator('.site-policy>summary').click();await tip.getByRole('button',{name:'Add this site to blacklist',exact:true}).click();
  await expect(tip.locator('.site-blocked')).toBeVisible();await expect(tip.getByRole('button',{name:'Apply'})).toHaveCount(0);await expect(draft).toHaveValue('你好，世界。');
  await draft.fill('屏蔽后输入不触发远程翻译。');await p.waitForTimeout(1100);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(1);
  await draft.press('Alt+Shift+E');await expect(tip.getByRole('button',{name:'Remove this site from blacklist',exact:true})).toBeVisible();expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(1);
  await tip.getByRole('button',{name:'Remove this site from blacklist',exact:true}).click();await expect(tip.getByText('Not on blacklist',{exact:true})).toHaveCount(0);
  await draft.fill('恢复后可以正常翻译。');await expect(tip.getByText('Hello, world.',{exact:true})).toBeVisible();expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(2);
  await p.evaluate(()=>window.__coachSetSettings({blocklist:['*.'+location.hostname]}));await draft.focus();await draft.press('Alt+Shift+E');await expect(tip.getByRole('button',{name:'Manage blacklist rule',exact:true})).toBeVisible();await expect(tip.getByRole('button',{name:'Remove this site from blacklist',exact:true})).toHaveCount(0);
  await p.screenshot({path:'test-results/blacklist-tooltip.png',animations:'disabled'});await p.close();
});
test('whitelist with no entries stays off, then runs only after adding the current hostname',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>window.__coachSetSettings({siteMode:'whitelist',allowlist:[]}));const draft=p.getByRole('textbox',{name:'Draft',exact:true});
  await draft.fill('空白名单不应该处理输入。');await p.waitForTimeout(1100);expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(0);
  await p.evaluate(()=>window.__coachSetSettings({allowlist:[location.hostname]}));await draft.fill('加入白名单后可以翻译。');await p.locator('input-coach-tip .site-policy>summary').click();await expect(p.locator('input-coach-tip').getByText('Whitelist mode',{exact:true})).toBeVisible();
  await expect(p.locator('input-coach-tip').getByRole('button',{name:'Add this site to blacklist',exact:true})).toHaveCount(0);await p.close();
});

test('popup target language persists independently of UI language; thinking is per-configuration and defaults off',async()=>{
  const p=await context.newPage();await p.goto(`chrome-extension://${extensionId}/popup.html`);await expect(p.locator('#target-language-popup')).toHaveValue('en');
  await p.locator('#target-language-popup').selectOption('zh');await expect(p.getByRole('status')).toHaveText('Target language saved.');await p.reload();await expect(p.locator('#target-language-popup')).toHaveValue('zh');
  await p.goto(`chrome-extension://${extensionId}/settings.html`);await expect(p.locator('#targetLanguage')).toHaveValue('zh');await expect(p.locator('#llm-thinking')).not.toBeChecked();
  await p.locator('#llm-thinking').check();await p.locator('#llm-thinkingProtocol').selectOption('enable_thinking');await p.getByRole('button',{name:'Save preferences ↗',exact:true}).click();await expect(p.getByRole('status')).toHaveText('Preferences saved.');
  await p.reload();await expect(p.locator('#llm-thinking')).toBeChecked();await expect(p.locator('#llm-thinkingProtocol')).toHaveValue('enable_thinking');
  await p.locator('#ui-language').selectOption('zh-CN');await expect(p.locator('#targetLanguage')).toHaveValue('zh');await expect(p.getByText('启用思考 / 推理（默认关闭）',{exact:true})).toBeVisible();
  await p.screenshot({path:'test-results/thinking-target-zh.png',fullPage:true});
  await p.locator('#llm-thinking').uncheck();await p.locator('#llm-thinkingProtocol').selectOption('auto');await p.locator('#targetLanguage').selectOption('en');await p.locator('#ui-language').selectOption('en');await p.getByRole('button',{name:'Save preferences ↗',exact:true}).click();await expect(p.getByRole('status')).toHaveText('Preferences saved.');await p.close();
});

test('MT and LLM start together, no empty tooltip appears, and LLM folds an earlier MT result',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={mt:200,llm:1200};window.__coachResponses={mt:{text:'Machine result.',engine:'Fixture MT',category:'basic'},llm:{text:'Refined result.',engine:'Fixture LLM',category:'llm',vocabulary:[]}};});
  const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');await draft.fill('请处理这句话。');await p.waitForFunction(()=>window.__coachRequests.length===2);await expect(tip).toHaveCount(0);
  expect(await p.evaluate(()=>window.__coachRequests.map(r=>r.lane).sort())).toEqual(['llm','mt']);
  await expect(tip.getByText('Machine result.',{exact:true})).toBeVisible();await expect(tip.getByText('LLM refinement is still running…')).toBeVisible();await tip.screenshot({path:'test-results/parallel-mt-first.png',animations:'disabled'});
  await expect(tip.locator('.suggestion')).toHaveText('Refined result.');await expect(tip.locator('.mt-result')).not.toHaveAttribute('open','');await expect(tip.locator('.mt-text')).toBeHidden();
  await tip.locator('.mt-result>summary').click();await expect(tip.locator('.mt-text')).toHaveText('Machine result.');await tip.getByRole('button',{name:'Apply MT',exact:true}).click();await expect(draft).toHaveValue('Machine result.');
  await expect.poll(async()=>(await p.evaluate(()=>window.__coachMetrics)).reduce((n,d)=>n+(d.suggestions||0),0)).toBe(1);await p.close();
});

test('LLM stays primary when MT finishes later and vocabulary interaction survives the MT update',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={mt:1400,llm:150};});
  const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');await draft.fill('请简化这个流程。');await expect(tip.locator('.suggestion')).toHaveText('We should streamline this process.');
  await tip.getByRole('button',{name:'streamline',exact:true}).click();await expect(tip.getByRole('button',{name:'Save for review',exact:true})).toBeVisible();
  await expect(tip.locator('.mt-result')).toBeAttached();await expect(tip.locator('.mt-text')).toBeHidden();await expect(tip.locator('.suggestion')).toHaveText('We should streamline this process.');await expect(tip.getByRole('button',{name:'Save for review',exact:true})).toBeVisible();
  await tip.screenshot({path:'test-results/parallel-llm-primary.png',animations:'disabled'});await p.close();
});

test('one failed lane preserves the other result, and applying early MT suppresses the late LLM',async()=>{
  for(const failed of ['llm','mt']){
    const p=await pageWithCoach();await p.evaluate(failed=>{window.__coachSetSettings({llmEnabled:true});window.__coachFailures={[failed]:true};window.__coachDelays={mt:100,llm:300};},failed);
    await p.getByRole('textbox',{name:'Draft',exact:true}).fill('这是合成测试。');const tip=p.locator('input-coach-tip');
    await expect(tip.locator('.suggestion')).toHaveText(failed==='llm'?'Hello, world.':'We should streamline this process.');await expect(tip.getByText(failed==='llm'?/LLM unavailable; showing MT\./:'MT unavailable; showing LLM.')).toBeVisible();await p.close();
  }
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={mt:100,llm:1000};});const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('先应用机器翻译。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');await tip.getByRole('button',{name:'Apply',exact:false}).click();await expect(draft).toHaveValue('Hello, world.');await p.waitForTimeout(1100);await expect(tip).toHaveCount(0);await p.close();
});

test('target changes invalidate both pending lanes; Chinese results are shown only for a fresh request',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={mt:600,llm:800};});const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('旧的中文输入。');await p.waitForFunction(()=>window.__coachRequests.length===2);await p.evaluate(()=>window.__coachSetSettings({targetLanguage:'zh'}));await p.waitForTimeout(900);await expect(tip).toHaveCount(0);
  await p.evaluate(()=>{window.__coachDelays={mt:100,llm:300};window.__coachResponses={mt:{text:'机器翻译结果。',engine:'MT',category:'basic'},llm:{text:'润色后的中文结果。',engine:'LLM',category:'llm',vocabulary:[]}};});await draft.fill('A new English sentence.');await expect(tip.locator('.suggestion')).toHaveText('润色后的中文结果。');await expect(tip.locator('.mt-text')).toHaveText('机器翻译结果。');await expect(draft).toHaveValue('A new English sentence.');await p.close();
});

test('a late LLM cannot replace the Apply button between pointer down and click on MT',async()=>{
  const p=await pageWithCoach();await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={mt:100,llm:700};});const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');
  await draft.fill('请翻译这句话。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');const box=await tip.getByRole('button',{name:'Apply',exact:false}).boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.waitForTimeout(800);
  await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');await p.mouse.up();await expect(draft).toHaveValue('Hello, world.');await expect(tip).toHaveCount(0);await p.close();
});

test('compact console bounds desktop width, places common settings above the fold, and fits small bilingual screens',async()=>{
  const p=await context.newPage();await p.setViewportSize({width:1920,height:1080});await p.goto(`chrome-extension://${extensionId}/settings.html`);await p.locator('#ui-language').selectOption('en');
  expect(await p.locator('.shell').evaluate(e=>e.getBoundingClientRect().width)).toBeLessThanOrEqual(1180);
  const llm=await p.locator('#llm').boundingBox(),practice=await p.locator('#practice').boundingBox();expect(Math.abs(llm.y-practice.y)).toBeLessThan(2);expect(llm.width).toBeLessThan(510);expect(practice.width).toBeLessThan(510);
  await p.locator('#llm-provider').selectOption('compatible');await p.locator('#llm-model').fill('unsaved-layout-model');await p.locator('.section-nav a[href="#websites"]').click();await expect(p).toHaveURL(/#websites$/);await expect(p.locator('#llm-model')).toHaveValue('unsaved-layout-model');
  for(const language of ['en','zh-CN']){
    await p.locator('#ui-language').selectOption(language);
    for(const width of [1440,768,390]){
      await p.setViewportSize({width,height:1000});await p.evaluate(()=>scrollTo(0,0));expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(width===1440)await p.screenshot({path:`test-results/compact-settings-${language}.png`,animations:'disabled'});
      if(width===390)await p.screenshot({path:`test-results/compact-settings-mobile-${language}.png`,fullPage:true,animations:'disabled'});
    }
  }
  await p.setViewportSize({width:1440,height:1000});await p.goto(`chrome-extension://${extensionId}/dashboard.html`);expect(await p.locator('.stat').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(120);await p.screenshot({path:'test-results/compact-dashboard-zh.png',animations:'disabled'});
  await p.goto(`chrome-extension://${extensionId}/vocabulary.html`);await p.screenshot({path:'test-results/compact-vocabulary-zh.png',animations:'disabled'});
  await p.goto(`chrome-extension://${extensionId}/popup.html`);expect(await p.locator('body').evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(650);await p.locator('body').screenshot({path:'test-results/compact-popup-zh.png',animations:'disabled'});
  await p.locator('#ui-language').selectOption('en');await p.close();
});

test('configuration download and reviewed import restore saved preferences, sites and positions without exporting secrets',async()=>{
  const p=await context.newPage();await p.goto(`chrome-extension://${extensionId}/settings.html`);
  const snapshot=await p.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));
  try{
    const configured=await p.evaluate(async()=>{
      const {data}=await chrome.runtime.sendMessage({type:'state'}),s=data.settings;
      for(const config of Object.values(s.basic))config.consent=false;
      const a={...s.llmProfiles[0],id:'default',name:'Backup <img src=x onerror=window.__badImport=1>',provider:'compatible',endpoint:'https://backup.test/v1',model:'backup-model',enabled:false,consent:false,rememberKey:false};
      const b={...a,id:'backup-work',name:'Work',model:'work-model'};s.llmProfiles=[a,b];s.activeLlmId='default';const {id,name,...config}=a;s.llm=config;
      s.mode='translate';s.targetLanguage='zh';s.dailyGoal=345;s.siteOrigins=[];
      const reply=await chrome.runtime.sendMessage({type:'save-settings',settings:s,keys:{llm:'synthetic-do-not-export'}});
      await chrome.storage.local.set({uiLanguage:'en',sitePreferences:{'chatgpt.com':{mode:'polish',llmProfileId:'backup-work'}},tooltipPositions:{'chatgpt.com':{x:.3,y:.7}},analytics:{fixture:{typed:7}},vocabulary:[{word:'preserved'}],usage:{requests:5}});return reply;
    });expect(configured.ok).toBe(true);await p.reload();await expect(p.locator('#llm-model')).toHaveValue('backup-model');
    await p.locator('#llm-model').fill('unsaved-model');await p.locator('#llm-key').fill('unsaved-secret');
    const downloaded=p.waitForEvent('download');await p.locator('#export-config').click();const download=await downloaded;expect(download.suggestedFilename()).toBe('saywell-configuration.json');
    const raw=await readFile(await download.path(),'utf8'),backup=JSON.parse(raw);
    expect(backup.format).toBe('saywell-configuration');expect(backup.settings.llmProfiles[0].model).toBe('unsaved-model');
    for(const secret of ['synthetic-do-not-export','unsaved-secret','vocabulary','rememberKey','consent'])expect(raw).not.toContain(secret);
    expect(backup.analytics).toBeUndefined();expect(backup.sitePreferences['chatgpt.com'].llmProfileId).toBe('backup-work');
    await p.locator('#llm-key').fill('');await p.locator('#llm-model').fill('changed-model');await p.locator('#dailyGoal').fill('999');await p.getByRole('button',{name:'Save preferences',exact:false}).click();await expect(p.getByRole('status')).toContainText('Preferences saved.');
    await p.evaluate(()=>chrome.storage.local.set({sitePreferences:{},tooltipPositions:{}}));await p.locator('#ui-language').selectOption('zh-CN');
    const upload={name:'saywell-backup.json',mimeType:'application/json',buffer:Buffer.from(raw)};await p.locator('#config-file').setInputFiles(upload);
    await expect(p.locator('#config-import-title')).toHaveText('预览配置导入');await expect(p.locator('#config-import-summary')).toContainText('2 组大模型配置');
    await expect(p.locator('#config-import-profiles img')).toHaveCount(0);expect(await p.evaluate(()=>window.__badImport)).toBeUndefined();await expect(p.locator('#llm-model')).toHaveValue('changed-model');
    await p.locator('#cancel-config-import').click();await expect(p.locator('#config-import-preview')).toBeHidden();await expect(p.locator('#dailyGoal')).toHaveValue('999');
    await p.locator('#config-file').setInputFiles(upload);await expect(p.locator('#config-import-preview')).toBeVisible();
    await p.locator('#ui-language').selectOption('en');await expect(p.locator('#config-import-title')).toHaveText('Review configuration import');await expect(p.locator('#config-import-summary')).toContainText('2 LLM configurations');
    await p.locator('#config-import-preview').screenshot({path:'test-results/config-import-preview.png'});
    await p.locator('#confirm-config-import').click();await expect(p.getByRole('status')).toContainText('Configuration imported. Reauthorize providers');
    await expect(p.locator('#llm-model')).toHaveValue('unsaved-model');await expect(p.locator('#dailyGoal')).toHaveValue('345');await expect(p.locator('#targetLanguage')).toHaveValue('zh');await expect(p.locator('#llm-key')).toHaveValue('');
    const restored=await p.evaluate(async()=>({...(await chrome.storage.local.get(['sitePreferences','tooltipPositions','analytics','vocabulary','usage'])),state:(await chrome.runtime.sendMessage({type:'state'})).data}));
    expect(restored.sitePreferences).toEqual(backup.sitePreferences);expect(restored.tooltipPositions).toEqual(backup.tooltipPositions);expect(restored.analytics).toEqual({fixture:{typed:7}});expect(restored.vocabulary).toEqual([{word:'preserved'}]);expect(restored.usage).toEqual({requests:5});
    expect(restored.state.hasKeys.llm).toBe(true);expect(restored.state.settings.llm.consent).toBe(false);await expect(p.locator('#config-import-preview')).toBeHidden();
  }finally{await p.evaluate(async snapshot=>{await chrome.storage.local.clear();await chrome.storage.session.clear();await chrome.storage.local.set(snapshot.local);await chrome.storage.session.set(snapshot.session);},snapshot);await p.close();}
});

test('configuration import rejects bad files, previews permission scope and handles denied access without a write',async()=>{
  const p=await context.newPage();await p.goto(`chrome-extension://${extensionId}/settings.html`);
  const snapshot=await p.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));
  try{
    await p.locator('#ui-language').selectOption('en');const before=await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings);
    const backup=await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'export-config'})).data);
    for(const[text,message]of [['invalid JSON','Invalid configuration JSON.'],[JSON.stringify({...backup,version:9}),'Unsupported configuration file or version.'],[JSON.stringify({...backup,keys:{llm:'reject-key'}}),'Configuration contains unsupported or sensitive fields.'],['a'.repeat(1024*1024+1),'Configuration file is too large (maximum 1 MiB).']]){
      await p.locator('#config-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(p.getByRole('status')).toHaveText(message);await expect(p.locator('#config-import-preview')).toBeHidden();
      expect(await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings)).toEqual(before);
    }
    backup.settings.siteOrigins=['https://needs-permission.example/*'];
    await p.locator('#config-file').setInputFiles({name:'access.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await expect(p.locator('#config-import-preview')).toBeVisible();await expect(p.locator('#config-import-access')).not.toBeChecked();
    await expect(p.locator('#config-import-permissions')).toContainText('1 website scopes need permission');
    await p.evaluate(()=>{chrome.permissions.request=async options=>{window.__configPermissionCalls=options.origins;return false;};});
    await p.locator('#config-import-access').check();await p.locator('#confirm-config-import').click();await expect(p.getByRole('status')).toHaveText('Website access was not granted. Nothing was imported.');await expect(p.getByRole('status')).toBeVisible();
    expect(await p.evaluate(()=>window.__configPermissionCalls)).toEqual(['https://needs-permission.example/*']);expect(await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings)).toEqual(before);
    await p.locator('#config-import-access').uncheck();await p.setViewportSize({width:390,height:1000});expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.locator('#config-import-preview').screenshot({path:'test-results/config-import-mobile.png'});
    await p.locator('#confirm-config-import').click();await expect(p.getByRole('status')).toContainText('1 website scopes were skipped');
    expect((await p.evaluate(async()=>(await chrome.runtime.sendMessage({type:'state'})).data.settings)).siteOrigins).toEqual([]);
  }finally{await p.evaluate(async snapshot=>{await chrome.storage.local.clear();await chrome.storage.session.clear();await chrome.storage.local.set(snapshot.local);await chrome.storage.session.set(snapshot.session);},snapshot);await p.close();}
});

async function providerSetupPage(profile={}){
  const p=await context.newPage(),defaults=mergeSettings({llm:{}});
  const settings=mergeSettings({llmProfiles:[...defaults.llmProfiles,{...defaults.llmProfiles[0],id:'work',name:'Work',endpoint:'https://work.example/v1',model:'work-model'}]});
  Object.assign(settings.llmProfiles[0],profile);settings.llm={...settings.llm,...profile};
  await p.addInitScript(settings=>{
    window.__providerSettings=settings;window.__providerCalls=[];window.__providerAllow=true;window.__providerFailure=false;window.__providerKeys={};
    chrome.permissions.request=async options=>{window.__providerCalls.push({type:'permission',origins:options.origins});if(window.__providerPermissionWait)await new Promise(resolve=>window.__providerPermissionResolve=resolve);return window.__providerAllow;};
    chrome.runtime.sendMessage=async message=>{
      if(message.type==='setup-status')return {ok:true,data:{needed:false,initial:false}};
      if(message.type==='state')return {ok:true,data:{settings:structuredClone(window.__providerSettings),hasKeys:{},hasProfileKeys:Object.fromEntries(Object.keys(window.__providerKeys).map(id=>[id,true]))}};
      if(message.type==='save-settings'){
        window.__providerCalls.push({type:'save',settings:structuredClone(message.settings)});window.__providerSettings=structuredClone(message.settings);Object.assign(window.__providerKeys,message.profileKeys);return {ok:true,data:true};
      }
      if(message.type==='test-llm' || message.type==='test-basic'){
        window.__providerCalls.push({type:message.type,profileId:message.profileId,id:message.id});
        return window.__providerFailure?{ok:false,error:'Authentication failed. Check your key and endpoint.'}:{ok:true,data:{engine:message.type==='test-llm'?'Synthetic LLM':'MyMemory',text:'Hello, world.'}};
      }
      return {ok:false,error:'Unexpected synthetic UI message.'};
    };
  },settings);
  await p.goto(`chrome-extension://${extensionId}/settings.html`);await p.locator('#ui-language').selectOption('en');await expect(p.locator('#llm-profile')).toHaveValue('default');return p;
}

test('settings autosave and toast without a save click; slow acknowledgements preserve newer edits and credentials',async()=>{
  const p=await providerSetupPage();try{
    await p.locator('#dailyGoal').fill('512');await expect.poll(()=>p.evaluate(()=>window.__providerSettings.dailyGoal)).toBe(512);await expect(p.locator('#save-toast.visible')).toHaveText('Preferences saved.');
    await p.evaluate(()=>{
      const original=chrome.runtime.sendMessage;window.__delaySave=true;
      chrome.runtime.sendMessage=async message=>{if(message.type==='save-settings' && window.__delaySave){window.__delaySave=false;await new Promise(resolve=>{window.__resumeSave=resolve;});}return original(message);};
    });
    await p.locator('#dailyGoal').fill('618');await p.waitForFunction(()=>window.__resumeSave);
    await p.locator('#llm-profile-name').fill('Edited during save');await p.locator('#llm-key').fill('synthetic-autosave-key');await p.locator('#dailyGoal').fill('619');
    await p.waitForTimeout(750);await p.evaluate(()=>window.__resumeSave());
    await expect.poll(()=>p.evaluate(()=>window.__providerSettings.dailyGoal)).toBe(619);
    await expect(p.locator('#llm-profile-name')).toHaveValue('Edited during save');await expect(p.locator('#dailyGoal')).toBeFocused();
    await expect(p.locator('#llm-key')).toHaveValue('');expect(await p.evaluate(()=>window.__providerKeys.default)).toBe('synthetic-autosave-key');
    await expect(p.locator('#save-toast.visible')).toHaveText('Preferences saved.');
    await p.screenshot({path:'test-results/settings-autosave-toast.png'});
  }finally{await p.close();}
});

test('invalid settings and failed autosaves retain input and last saved values; correcting a value saves again',async()=>{
  const p=await providerSetupPage();try{
    await p.locator('#dailyGoal').fill('0');await expect(p.locator('#save-toast.visible.error')).toContainText('could not be saved');
    expect(await p.evaluate(()=>window.__providerSettings.dailyGoal)).toBe(200);await expect(p.locator('#dailyGoal')).toHaveValue('0');
    await p.locator('#dailyGoal').fill('410');await expect.poll(()=>p.evaluate(()=>window.__providerSettings.dailyGoal)).toBe(410);
    await p.evaluate(()=>{const original=chrome.runtime.sendMessage;window.__rejectSave=true;chrome.runtime.sendMessage=async message=>message.type==='save-settings' && window.__rejectSave?{ok:false,error:'Synthetic storage failure.'}:original(message);});
    await p.locator('#dailyGoal').fill('411');await expect(p.getByRole('status')).toHaveText('Synthetic storage failure.');
    expect(await p.evaluate(()=>window.__providerSettings.dailyGoal)).toBe(410);await expect(p.locator('#dailyGoal')).toHaveValue('411');
    await p.evaluate(()=>{window.__rejectSave=false;});await p.locator('#dailyGoal').fill('412');await expect.poll(()=>p.evaluate(()=>window.__providerSettings.dailyGoal)).toBe(412);
  }finally{await p.close();}
});

test('one connection click grants, saves, enables and tests the selected LLM without activating it; disable preserves access and keys',async()=>{
  const p=await providerSetupPage();try{
    await expect(p.locator('[data-authorize]')).toHaveCount(0);await expect(p.locator('[data-revoke="llm"]')).toBeHidden();
    await p.locator('#llm-profile').selectOption('work');await p.locator('#llm-key').fill('synthetic-work-key');
    await p.locator('#test-llm').click();await expect(p.getByRole('status')).toHaveText('Connected to Synthetic LLM. Synthetic request completed.');
    await expect(p.locator('#llm-enabled')).toBeChecked();await expect(p.locator('#llm-state')).toHaveText('Service enabled');await expect(p.locator('[data-revoke="llm"]')).toBeVisible();
    let calls=await p.evaluate(()=>window.__providerCalls);expect(calls.map(c=>c.type)).toEqual(['permission','save','test-llm']);expect(calls[0].origins).toEqual(['https://work.example/*']);
    expect(calls[1].settings.activeLlmId).toBe('default');expect(calls[1].settings.llmProfiles.find(p=>p.id==='work')).toMatchObject({enabled:true,consent:true});expect(calls[1].settings.llmProfiles[0].consent).toBe(false);expect(calls[2].profileId).toBe('work');
    await p.locator('#ui-language').selectOption('zh-CN');await expect(p.locator('#test-llm')).toHaveText('连接并测试');await expect(p.locator('[data-revoke="llm"]')).toHaveText('停用服务');
    await p.locator('[data-revoke="llm"]').click();await expect(p.getByRole('status')).toHaveText('服务已停用，将停止向它发送新的文本。');await expect(p.locator('[data-revoke="llm"]')).toBeHidden();await expect(p.locator('#llm-enabled')).not.toBeChecked();
    calls=await p.evaluate(()=>window.__providerCalls);expect(calls.map(c=>c.type)).toEqual(['permission','save','test-llm','save']);expect(calls.at(-1).settings.llmProfiles.find(p=>p.id==='work').consent).toBe(false);
    expect(await p.evaluate(()=>window.__providerKeys.work)).toBe('synthetic-work-key');
    // The disable save has no new key values; it neither forgets keys nor removes browser grants.
    await p.locator('#ui-language').selectOption('en');await p.evaluate(()=>window.__providerFailure=true);await p.locator('#test-llm').click();await expect(p.getByRole('status')).toHaveText('Authentication failed. Check your key and endpoint.');await expect(p.locator('#llm-state')).toHaveText('Service enabled');
    await p.locator('#llm').screenshot({path:'test-results/provider-connect-en.png',style:'.save-bar{visibility:hidden}'});
  }finally{await p.close();}
});

test('connection denies invalid or ungranted endpoints, cancels changed configurations, and enables only the selected basic service',async()=>{
  const p=await providerSetupPage();try{
    await p.locator('#test-llm').click();await expect(p.getByRole('status')).toHaveText('Enter an API base URL and model before connecting.');expect(await p.evaluate(()=>window.__providerCalls)).toEqual([]);
    await p.locator('#llm-profile').selectOption('work');await p.evaluate(()=>window.__providerAllow=false);await p.locator('#test-llm').click();await expect(p.getByRole('status')).toHaveText('Endpoint permission was not granted.');await expect(p.locator('#llm-enabled')).not.toBeChecked();await expect(p.locator('[data-revoke="llm"]')).toBeHidden();
    expect((await p.evaluate(()=>window.__providerCalls)).map(c=>c.type)).toEqual(['permission']);
    await p.evaluate(()=>{window.__providerAllow=true;window.__providerPermissionWait=true;});await p.locator('#test-llm').click();await p.waitForFunction(()=>Boolean(window.__providerPermissionResolve));await p.locator('#llm-endpoint').fill('https://changed.example/v1');await p.evaluate(()=>window.__providerPermissionResolve());await expect(p.getByRole('status')).toHaveText('Configuration changed. Connect the selected service again.');
    expect((await p.evaluate(()=>window.__providerCalls)).map(c=>c.type)).toEqual(['permission','permission']);
    await p.evaluate(()=>{window.__providerPermissionWait=false;window.__providerCalls=[];});await p.locator('[data-test="mymemory"]').click();await expect(p.getByRole('status')).toHaveText('MyMemory: Hello, world.');
    let calls=await p.evaluate(()=>window.__providerCalls);expect(calls.map(c=>c.type)).toEqual(['permission','save','test-basic']);expect(calls[0].origins).toEqual(['https://api.mymemory.translated.net/*']);expect(calls[1].settings.basic.mymemory.consent).toBe(true);expect(calls[1].settings.basic.microsoft.consent).toBe(false);expect(calls[1].settings.llmProfiles.find(p=>p.id==='work').consent).toBe(false);
    await p.locator('[data-revoke="mymemory"]').click();await expect(p.locator('#mymemory-state')).toHaveText('Service not connected');
    await p.locator('#ui-language').selectOption('zh-CN');await p.setViewportSize({width:390,height:1000});expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.locator('#engines').screenshot({path:'test-results/provider-connect-mobile-zh.png',style:'.save-bar{visibility:hidden}'});
  }finally{await p.locator('#ui-language').selectOption('en');await p.close();}
});

test('free quick start requests exactly four origins, keeps other providers off and reconnects changed web addresses explicitly',async()=>{
  const p=await providerSetupPage();try{
    await p.evaluate(()=>window.__providerAllow=false);await p.locator('#enable-free').click();await expect(p.getByRole('status')).toHaveText('Endpoint permission was not granted.');expect((await p.evaluate(()=>window.__providerCalls)).map(c=>c.type)).toEqual(['permission']);
    await p.evaluate(()=>{window.__providerAllow=true;window.__providerCalls=[];});await p.locator('#enable-free').click();await expect(p.getByRole('status')).toContainText('No-key fallback enabled. Google, Bing');
    const calls=await p.evaluate(()=>window.__providerCalls);expect(calls.map(c=>c.type)).toEqual(['permission','save']);expect(calls[0].origins).toEqual(['https://translate.googleapis.com/*','https://cn.bing.com/*','https://edge.microsoft.com/*','https://api.mymemory.translated.net/*']);
    for(const id of ['googleweb','bing','microsoft','mymemory'])expect(calls[1].settings.basic[id].consent).toBe(true);
    for(const id of ['libre','azure','google'])expect(calls[1].settings.basic[id].consent).toBe(false);expect(calls[1].settings.llm.consent).toBe(false);
    await expect(p.locator('#basicEngine option[value="googleweb"]')).toHaveCount(1);await expect(p.locator('#basicEngine option[value="bing"]')).toHaveCount(1);
    await p.getByText('Web translation addresses',{exact:true}).click();await p.locator('#bing-endpoint').fill('https://www.bing.com');await expect(p.locator('#bing-state')).toHaveText('Service not connected');
    await p.locator('[data-test="bing"]').click();await expect(p.getByRole('status')).toHaveText('MyMemory: Hello, world.');expect((await p.evaluate(()=>window.__providerCalls)).at(-3).origins).toEqual(['https://www.bing.com/*']);
    await p.locator('#ui-language').selectOption('zh-CN');await expect(p.locator('#enable-free')).toHaveText('启用免费翻译');await expect(p.locator('#basicEngine option[value="googleweb"]')).toHaveText('Google 翻译（网页版，实验性）');
    await p.setViewportSize({width:390,height:1000});expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.locator('#engines').screenshot({path:'test-results/web-engines-mobile-zh.png',style:'.save-bar,.sidebar,.section-nav{visibility:hidden}'});
  }finally{await p.locator('#ui-language').selectOption('en');await p.close();}
});

test('tooltip Small, Medium and Large resize in place, preserve late results and Apply, remember the host and clamp to narrow windows',async()=>{
  const p=await pageWithCoach();try{
    await p.setViewportSize({width:1200,height:850});await p.evaluate(()=>{window.__coachSetSettings({llmEnabled:true});window.__coachDelays={llm:1500,mt:0};});
    const draft=p.getByRole('textbox',{name:'Draft',exact:true}),tip=p.locator('input-coach-tip');await draft.fill('浮窗大小测试。');await expect(tip.locator('.suggestion')).toHaveText('Hello, world.');
    const size=tip.getByRole('combobox',{name:'Tooltip size',exact:true});await expect(size).toHaveValue('small');expect((await tip.boundingBox()).width).toBe(300);
    const requestCount=await p.evaluate(()=>window.__coachRequests.length);for(const[value,width]of [['medium',380],['large',480],['small',300]]){await size.selectOption(value);await expect(tip).toHaveAttribute('data-size',value);expect((await tip.boundingBox()).width).toBe(width);await tip.screenshot({path:`test-results/tooltip-size-${value}.png`});}
    await expect(draft).toHaveValue('浮窗大小测试。');expect(await p.evaluate(()=>window.__coachRequests.length)).toBe(requestCount);
    await size.selectOption('large');await draft.focus();await expect(tip.locator('.suggestion')).toHaveText('We should streamline this process.');await expect(tip.getByRole('combobox',{name:'Tooltip size',exact:true})).toHaveValue('large');
    await p.setViewportSize({width:350,height:300});await expect.poll(async()=>{const b=await tip.boundingBox();return b.width<=326 && b.x>=11.5 && b.x+b.width<=338.5 && b.y>=11.5 && b.y+b.height<=288.5;}).toBe(true);
    await p.setViewportSize({width:1200,height:850});await tip.getByRole('button',{name:'Apply ↗',exact:true}).click();await expect(draft).toHaveValue('We should streamline this process.');
    await p.reload();await p.addScriptTag({path:path.resolve('tests/browser/mock-runtime.js')});await p.addScriptTag({path:path.resolve('dist/content.js')});await draft.fill('恢复大小。');await expect(tip).toHaveAttribute('data-size','large');await expect(tip.getByRole('combobox',{name:'Tooltip size',exact:true})).toHaveValue('large');
    await p.evaluate(()=>window.__coachSetSettings({uiLanguage:'zh-CN'}));await draft.fill('中文大小选项。');await expect(tip.getByRole('combobox',{name:'浮窗大小',exact:true})).toBeVisible();await expect(tip.getByRole('combobox',{name:'浮窗大小',exact:true}).locator('option')).toHaveText(['小','中','大']);
  }finally{await p.close();}
});

test('Saywell free AI preset fills endpoint and fixed model, needs no key and keeps thinking off without making automatic calls',async()=>{
  const p=await providerSetupPage();try{
    await p.locator('#llm-provider').selectOption('saywell');await expect(p.locator('#llm-model')).toHaveValue('@cf/qwen/qwen3-30b-a3b-fp8');await expect(p.locator('#llm-model')).not.toBeEditable();await expect(p.locator('#llm-key')).toBeHidden();await expect(p.locator('#llm-thinking')).not.toBeChecked();await expect(p.locator('#llm-provider-help')).toContainText('08:00');
    expect((await p.evaluate(()=>window.__providerCalls)).filter(c=>c.type!=='save')).toEqual([]);await p.locator('#test-llm').click();await expect(p.getByRole('status')).toHaveText('Connected to Synthetic LLM. Synthetic request completed.');const calls=await p.evaluate(()=>window.__providerCalls);expect(calls.filter(c=>c.type!=='save').map(c=>c.type)).toEqual(['permission','test-llm']);expect(calls.find(c=>c.type==='permission').origins).toEqual([new URL(HOSTED_AI_ENDPOINT).origin+'/*']);
    await p.locator('#ui-language').selectOption('zh-CN');await expect(p.locator('#llm-provider-help')).toContainText('免费额度');await p.locator('#llm').screenshot({path:'test-results/saywell-free-ai-zh.png',style:'.save-bar,.section-nav{visibility:hidden}'});
  }finally{await p.locator('#ui-language').selectOption('en');await p.close();}
});

test('legacy free AI address changes only on Connect and test, renewing permission and consent for the custom domain',async()=>{
  const p=await providerSetupPage({...mergeSettings().llm,endpoint:LEGACY_HOSTED_AI_ENDPOINT,enabled:true,consent:true});try{
    await expect(p.locator('#llm-endpoint')).toHaveValue(LEGACY_HOSTED_AI_ENDPOINT);await expect(p.locator('.endpoint-update')).toContainText(HOSTED_AI_ENDPOINT);
    expect((await p.evaluate(()=>window.__providerCalls)).filter(c=>c.type==='permission' || c.type==='test-llm')).toEqual([]);
    await p.evaluate(()=>{window.__providerAllow=false;});await p.locator('#test-llm').click();await expect(p.getByRole('status')).toHaveText('Endpoint permission was not granted.');
    expect(await p.evaluate(()=>window.__providerSettings.llm.endpoint)).toBe(LEGACY_HOSTED_AI_ENDPOINT);expect((await p.evaluate(()=>window.__providerCalls)).filter(c=>c.type==='test-llm')).toEqual([]);
    await p.evaluate(()=>{window.__providerAllow=true;window.__providerCalls=[];});await p.locator('#test-llm').click();await expect(p.getByRole('status')).toContainText('Connected to Synthetic LLM');
    const calls=await p.evaluate(()=>window.__providerCalls);expect(calls.find(c=>c.type==='permission').origins).toEqual([new URL(HOSTED_AI_ENDPOINT).origin+'/*']);
    expect(await p.evaluate(()=>window.__providerSettings.llm)).toMatchObject({endpoint:HOSTED_AI_ENDPOINT,enabled:true,consent:true});
    await expect(p.locator('.endpoint-update')).toHaveCount(0);
  }finally{await p.close();}
});
