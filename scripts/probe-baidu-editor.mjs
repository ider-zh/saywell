// Explicit disposable live-UI probe. Inference calls, further HTTP and WebSockets are blocked before synthetic input.
import {chromium} from '@playwright/test';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(path.join(os.tmpdir(),'input-coach-baidu-probe-'));let context;
try{
  context=await chromium.launchPersistentContext(root,{headless:true,executablePath:process.env.INPUT_COACH_BROWSER});await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage();await page.goto('https://fanyi.baidu.com/',{waitUntil:'domcontentloaded',timeout:15000});const editor=page.locator('[data-slate-editor][contenteditable="true"]').first();await editor.waitFor({timeout:8000});
  await page.route('**/*',route=>route.abort());
  await page.addScriptTag({path:path.resolve('tests/browser/mock-runtime.js')});await page.addScriptTag({path:path.resolve('dist/content.js')});
  await editor.fill('你好，世界。');const tip=page.locator('input-coach-tip');await tip.waitFor({timeout:8000});const apply=tip.getByRole('button',{name:'Apply'});assert.equal(await apply.isEnabled(),true);
  await apply.click({timeout:5000});await page.waitForTimeout(1000);assert.deepEqual(await editor.locator('[data-slate-string]').allTextContents(),['Hello, world.']);
  await editor.press('End');await editor.press('!');await page.waitForTimeout(300);assert.deepEqual(await editor.locator('[data-slate-string]').allTextContents(),['Hello, world.!']);console.log('PASS: Baidu plain Slate auto suggestion, Apply, and subsequent model edit (synthetic text; subsequent network blocked).');
}finally{await context?.close();const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup path');await rm(absolute,{recursive:true,force:true});}
