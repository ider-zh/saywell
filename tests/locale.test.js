import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {resolveLanguage} from '../src/core/locale.js';
import chinese from '../src/locales/zh-CN.js';
import {siteInfo,siteText} from '../src/content/site-controls.js';
import {mergeSettings} from '../src/core/settings.js';

test('UI defaults follow the browser and explicit choices override detection',()=>{
  for(const language of ['zh','zh-CN','zh-TW','zh-Hant','ZH_hans'])assert.equal(resolveLanguage('auto',language),'zh-CN');
  for(const language of ['en','en-GB','ja-JP','fr-FR',''])assert.equal(resolveLanguage('auto',language),'en');
  assert.equal(resolveLanguage('en','zh-CN'),'en');assert.equal(resolveLanguage('zh-CN','en-US'),'zh-CN');
  assert.equal(resolveLanguage('invalid','zh-CN'),'zh-CN');
});
test('floating blacklist controls use UI language and distinguish inherited wildcard rules',()=>{
  const site=siteInfo('child.example.com',{...mergeSettings({blocklist:['*.example.com']}),uiLanguage:'zh-CN'},'en');
  assert.equal(site.blocked,true);assert.equal(site.canRemove,false);assert.equal(siteText(site,'On blacklist'),'已加入黑名单');assert.equal(siteText(site,'Blocked by rule: {rule}',{rule:site.rule}),'匹配的黑名单规则：*.example.com');
  assert.equal(siteInfo('example.com',mergeSettings({blocklist:['example.com']}),'en').canRemove,true);
});
test('all console template messages and accessibility labels have Chinese translations',async()=>{
  const brandOrExample=/^(?:[\d\s/—↗⚙◷▤⌁✧×]+|Saywell|SAYWELL \/ 0\.1|Aa|MyMemory|LibreTranslate|Google Cloud Translation|Microsoft Azure|OpenAI|DeepSeek)$/;
  for(const page of ['dashboard','settings','vocabulary','popup','welcome']){
    const {window}=new JSDOM(await readFile(`public/${page}.html`,'utf8'));const doc=window.document;
    for(const node of doc.querySelectorAll('[data-i18n]'))assert.ok(chinese[node.dataset.i18n],`${page}: ${node.dataset.i18n}`);
    for(const attribute of ['aria-label','placeholder','title'])for(const node of doc.querySelectorAll(`[data-i18n-${attribute}]`))assert.ok(chinese[node.getAttribute(`data-i18n-${attribute}`)]);
    const walker=doc.createTreeWalker(doc.documentElement,window.NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,value=node.textContent.trim();
      if(!/[a-z]/i.test(value) || node.parentElement.closest('[data-i18n],script,style') || brandOrExample.test(value))continue;
      assert.fail(`Unmarked console message in ${page}: ${value}`);
    }
  }
});
