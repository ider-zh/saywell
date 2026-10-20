import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSettings,publicSettings,validateSettings} from '../src/core/settings.js';
import {classify,routeAction,siteAllowed,insertedSpan} from '../src/core/language.js';
import {typingDelta,recordMetric,history,dayKey,emptyMetrics} from '../src/core/analytics.js';
import {endpointURL,originPattern,cleanResult} from '../src/core/security.js';
import {LLM_PROVIDERS} from '../src/core/llm-providers.js';

test('legacy single LLM migrates once and saved configurations have unique IDs and bounded fields',()=>{
  const old={llm:{provider:'mimo',model:'my-model',endpoint:'https://api.example/v1',enabled:true,consent:true}};
  const s=mergeSettings(old);assert.equal(s.activeLlmId,'default');assert.equal(s.llmProfiles[0].model,'my-model');assert.equal(s.llmProfiles[0].consent,true);
  assert.deepEqual(mergeSettings(s),s);
  const b={...s.llmProfiles[0],id:'second',name:'Work',model:'other-model'};
  const next=mergeSettings({llmProfiles:[s.llmProfiles[0],b],activeLlmId:'second'});assert.equal(next.llm.model,'other-model');assert.equal(validateSettings(next).llmProfiles.length,2);
  assert.throws(()=>validateSettings(mergeSettings({llmProfiles:[b,b]})),/configurations/);
  assert.throws(()=>validateSettings(mergeSettings({llmProfiles:[{...b,key:'must-not-live-in-settings'}]})),/configuration field/);
});

test('LLM presets are validated and preserve explicitly configured models and base URLs',()=>{
  for(const provider of Object.keys(LLM_PROVIDERS)){
    const s=mergeSettings({llm:{provider,endpoint:'https://custom.example/v1',model:'custom-model'}});
    assert.equal(validateSettings(s).llm.provider,provider);assert.equal(s.llm.endpoint,'https://custom.example/v1');assert.equal(s.llm.model,'custom-model');
  }
  assert.throws(()=>validateSettings(mergeSettings({llm:{provider:'toString'}})),/Invalid LLM provider/);
});

test('automatic routing includes English-only polishing and mixed input',()=>{
  assert.equal(classify('你好，这是一个测试。'),'chinese');assert.equal(classify('Please review 这个 PR before merging.'),'mixed');
  assert.equal(routeAction('This are my sentence.','auto',true).action,'polish');
  assert.equal(routeAction('This is natural.','auto',false).action,'none');
  assert.equal(routeAction('你好','explain',false).needsLLM,true);
  assert.equal(routeAction('Review 这个 PR','auto',true).action,'translate');
});
test('hostname policy prevents suffix and wildcard bypasses',()=>{
  const s=mergeSettings({allowlist:['*.github.com'],blocklist:['private.github.com']});
  assert.equal(siteAllowed('github.com',s),true);assert.equal(siteAllowed('evilgithub.com',s),false);
  assert.equal(siteAllowed('private.github.com',s),false);assert.equal(siteAllowed('github.com.evil.test',s),false);
});
test('blacklist is the default; whitelist is strict and both lists survive mode switching',()=>{
  const fresh=mergeSettings();assert.equal(fresh.siteMode,'blacklist');assert.equal(siteAllowed('new.example',fresh),true);
  const s=mergeSettings({siteMode:'blacklist',allowlist:['allowed.example'],blocklist:['*.blocked.example']});
  assert.equal(siteAllowed('unlisted.example',s),true);assert.equal(siteAllowed('sub.blocked.example',s),false);
  s.siteMode='whitelist';assert.equal(siteAllowed('unlisted.example',s),false);assert.equal(siteAllowed('allowed.example',s),true);
  assert.equal(siteAllowed('allowed.example',mergeSettings({siteMode:'whitelist'})),false);
  assert.deepEqual(s.allowlist,['allowed.example']);assert.deepEqual(s.blocklist,['*.blocked.example']);
  assert.equal(mergeSettings({allowlist:['legacy.example']}).siteMode,'whitelist');
  assert.throws(()=>validateSettings(mergeSettings({siteMode:'dark'})));
});
test('input analytics distinguish keypresses, composition, paste, Apply, and undo',()=>{
  let text='',total=emptyMetrics();for(const key of 'Hello world'){const delta=typingDelta(text,text+key,'insertText',key);for(const k in total)total[k]+=delta[k];text+=key;}
  assert.equal(total.english,2);assert.equal(total.typed,11);
  const chinese=typingDelta('','你好','insertCompositionText',null);assert.equal(chinese.chinese,2);assert.equal(chinese.typed,2);
  const paste=typingDelta('Hello','Hello secret text','insertFromPaste',null);assert.equal(paste.typed,0);assert.equal(paste.english,0);assert.equal(paste.pasted,12);
  assert.equal(typingDelta('a','hello','insertReplacementText','hello').typed,0);
  assert.equal(typingDelta('hi','','deleteContentBackward',null).typed,0);
  assert.equal(typingDelta('','hello','historyRedo','hello').typed,0);
  assert.equal(typingDelta('','😀','insertText','😀').typed,1);
});
test('diff handles Unicode and mid-sentence insertion',()=>{
  assert.deepEqual(insertedSpan('Hi world','Hi new world'),{text:'new ',before:'Hi ',after:'world'});
  assert.deepEqual(insertedSpan('😀a','😀b'),{text:'b',before:'😀',after:''});
});
test('analytics store numeric totals and hostnames only; calendar windows cross months',()=>{
  const store={};recordMetric(store,'2026-10-20','chatgpt.com',{typed:7,chinese:2,english:1,raw:'private draft'});
  assert.equal(store['2026-10-20'].sites['chatgpt.com'].typed,7);assert.ok(!JSON.stringify(store).includes('private'));
  const rows=history(store,30,new Date(2026,9,20));assert.equal(rows.length,30);assert.equal(rows[0].day,'2026-09-21');
  assert.equal(rows.at(-1).typed,7);assert.equal(dayKey(new Date(2026,0,1)),'2026-01-01');
  recordMetric(store,'2026-10-20','__proto__',{typed:2});assert.equal(Object.prototype.typed,undefined);assert.equal(Object.getOwnPropertyDescriptor(store['2026-10-20'].sites,'__proto__').value.typed,2);
});
test('endpoint safety blocks insecure remote URLs, embedded keys and path confusion',()=>{
  for(const bad of ['http://remote.test','https://user:key@host.test','https://host.test?key=secret','file:///secret','javascript:alert(1)'])assert.throws(()=>endpointURL(bad));
  assert.equal(originPattern('http://localhost:11434/v1'),'http://localhost:11434/*');
  assert.equal(originPattern('https://host.test/api/v1'),'https://host.test/*');
});
test('provider data is bounded, vocabulary is contextual and known words are excluded',()=>{
  const result=cleanResult({text:'Please streamline this workflow.',explanation:'More concise',vocabulary:[{word:'streamline',meaning:'精简'},{word:'workflow',meaning:'工作流程'},{word:'flow',meaning:'wrong partial word'},{word:'invented'}]},'Please simplify.',3,['workflow']);
  assert.equal(result.vocabulary.length,1);assert.equal(result.vocabulary[0].word,'streamline');
  assert.equal(cleanResult({text:'Already natural.',explanation:'ignore'},'Already natural.').explanation,'');
  assert.throws(()=>cleanResult({text:''},'source'));
});
test('settings defaults are no-network and content scripts see no endpoints or keys',()=>{
  const s=mergeSettings();assert.equal(s.basic.mymemory.consent,false);assert.equal(s.llm.enabled,true);assert.equal(s.llm.consent,false);assert.deepEqual(s.siteOrigins,[]);
  assert.ok(!JSON.stringify(publicSettings(s)).includes('endpoint'));assert.equal(validateSettings(s),s);
  assert.throws(()=>validateSettings(mergeSettings({maxWords:20})));assert.throws(()=>validateSettings(mergeSettings({llm:{timeout:1}})));
  assert.equal(s.basic.microsoft.consent,false);assert.equal(s.basic.azure.consent,false);assert.equal(s.basicFallback,true);
  assert.throws(()=>validateSettings(mergeSettings({basicOrder:['microsoft','microsoft']})));
  assert.throws(()=>validateSettings(mergeSettings({basic:{azure:{region:'bad\r\nheader'}}})));
});
