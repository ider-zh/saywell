import test,{beforeEach} from 'node:test';import assert from 'node:assert/strict';
import {mergeSettings,llmConfig} from '../src/core/settings.js';
import {LLM_PROVIDERS} from '../src/core/llm-providers.js';
import {createPrivateStorage} from '../src/core/private-storage.js';
import {exportConfigBackup} from '../src/core/config-backup.js';
const stores={local:{},session:{}},permissions=new Set(),network=[];let listener,bingPageHook;
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
const area=name=>({
  setAccessLevel:async({accessLevel})=>{assert.equal(accessLevel,'TRUSTED_CONTEXTS');},
  get:async keys=>{const names=typeof keys==='string'?[keys]:keys;return structuredClone(Object.fromEntries(names.filter(k=>stores[name][k]!==undefined).map(k=>[k,stores[name][k]])));},
  set:async data=>Object.assign(stores[name],structuredClone(data)),
  remove:async keys=>{for(const k of typeof keys==='string'?[keys]:keys)delete stores[name][k];}
});
globalThis.chrome={storage:{local:area('local'),session:area('session'),onChanged:event()},permissions:{contains:async({origins})=>origins.every(p=>permissions.has(p)),onRemoved:event()},scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{}},runtime:{getURL:p=>'chrome-extension://unit/'+p,onMessage:{addListener:fn=>{listener=fn;}},onInstalled:event(),onStartup:event(),openOptionsPage:async()=>{}},tabs:{query:async()=>[],get:async id=>({id,url:id===2?'https://chatgpt.com/':'https://ungranted.example/'}),sendMessage:async()=>{}},commands:{onCommand:event()}};
globalThis.fetch=async(url,opts)=>{
  network.push({url,opts});
  if(new URL(url).pathname==='/translator'){await bingPageHook?.();return new Response('var params_AbusePreventionHelper = [123456,"worker-page-token",600000]; IG:"ABC123", <div id="rich_tta" data-iid="translator.1">');}
  if(url.includes('/translate_a/single'))return new Response(JSON.stringify([[['Hello.']]]));
  if(url.includes('/ttranslatev3'))return new Response(JSON.stringify([{translations:[{text:'Hello.',to:'en'}]}]));
  return new Response(JSON.stringify(url.includes('mymemory')?{responseStatus:200,responseData:{translatedText:'Hello.'}}:url.includes('edge.microsoft.com')?[{translations:[{text:'Hello.',to:'en'}]}]:{choices:[{message:{content:'{"text":"This is correct.","vocabulary":[]}'}}]}));
};
const badges=[],opened=[];
globalThis.chrome.action={setBadgeText:async value=>badges.push(value.text),setBadgeBackgroundColor:async()=>{},setTitle:async()=>{}};
globalThis.chrome.tabs.create=async value=>opened.push(value.url);
globalThis.chrome.permissions.onAdded=event();
globalThis.chrome.permissions.contains=async({origins})=>origins.every(p=>permissions.has(p) || p.startsWith('https://') && permissions.has('https://*/*') || p.startsWith('http://') && permissions.has('http://*/*'));
await import('../src/background.js');
const privateView=createPrivateStorage(chrome.storage.local,chrome.storage.session);
const value=async field=>(await privateView.get(field))[field];
const createVault=()=>message({type:'vault-create',password:'Synthetic unit vault password'});
const ui={url:'chrome-extension://unit/settings.html'},site={url:'https://chatgpt.com/',tab:{id:2},frameId:0};
const message=(payload,sender=ui)=>new Promise(resolve=>listener(payload,sender,resolve));
beforeEach(()=>{stores.local={settings:mergeSettings({llm:{},siteOrigins:['https://chatgpt.com/*']})};stores.session={};permissions.clear();permissions.add('https://chatgpt.com/*');network.length=0;bingPageHook=null;});

test('vault lock rejects late writes and content access while preserving private data for explicit unlock',async()=>{
  assert.equal((await createVault()).ok,true);const generation=stores.local.historyGeneration;
  const entry={type:'record-history',generation,requestId:'vault-record',source:'Synthetic vault history',action:'translate',targetLanguage:'en',lane:'mt',result:{text:'Synthetic result',engine:'MT'}};
  assert.equal((await message(entry,site)).ok,true);
  for(const type of ['vault-status','vault-create','vault-unlock','vault-lock','vault-erase'])assert.equal((await message({type,password:'Synthetic unit vault password',confirm:true},site)).ok,false);
  await message({type:'vault-lock'});assert.equal((await message(entry,site)).data,false);assert.equal((await message({...entry,generation:stores.local.historyGeneration},site)).data,false);assert.equal((await message({type:'public-settings'},site)).data.historyLimit,0);
  assert.deepEqual((await message({type:'get-history'})).data.records,[]);await message({type:'vault-unlock',password:'Synthetic unit vault password'});assert.equal((await message({type:'get-history'})).data.records[0].source,entry.source);
  assert.ok(!JSON.stringify(stores.local).includes(entry.source));assert.equal((await message({type:'vault-erase'})).ok,false);
});

test('temporary pauses are scoped, persistent, expire by time and gate suggestions, analytics and local history',async()=>{
  const before=Date.now();assert.equal((await message({type:'set-snooze',scope:'site',duration:'1h'},site)).ok,true);
  assert.ok(stores.local.snoozes.sites['chatgpt.com']>=before+3600000);assert.equal(stores.local.settings.enabled,true);
  assert.ok((await message({type:'public-settings'},site)).data.snoozeUntil>Date.now());assert.equal((await message({type:'suggest',text:'合成测试',lane:'mt'},site)).ok,false);
  await message({type:'metric',delta:{typed:10}},site);assert.equal((await value('analytics')),undefined);
  assert.equal((await message({type:'record-history'},site)).ok,false);assert.equal(network.length,0);
  assert.equal((await message({type:'get-snooze'},site)).ok,false);
  const other={url:'https://other.example/',tab:{id:3}};assert.equal((await message({type:'set-snooze',scope:'all',duration:'4h'},other)).ok,false);
  assert.equal((await message({type:'set-snooze',scope:'site',duration:'forever'},site)).ok,false);
  assert.equal((await message({type:'set-snooze',scope:'all',duration:'4h'},site)).ok,true);
  assert.ok((await message({type:'get-snooze',tabId:2})).data.allUntil>Date.now());
  await message({type:'clear-snooze',scope:'all'});assert.ok((await message({type:'get-snooze',tabId:2})).data.siteUntil>Date.now());
  await message({type:'clear-snooze',scope:'site',tabId:2});assert.equal((await message({type:'public-settings'},site)).data.snoozeUntil,0);
  stores.local.snoozes={all:Date.now()-1,sites:{'chatgpt.com':Date.now()-1}};
  assert.equal((await message({type:'public-settings'},site)).data.snoozeUntil,0);await message({type:'metric',delta:{typed:7}},site);assert.ok((await value('analytics')));
  assert.equal((await message({type:'export-config'})).data.snoozes,undefined);
});

test('local history is site-gated, private to extension pages, merges lanes and never enters config/practice exports',async()=>{
  const entry={type:'record-history',generation:0,requestId:'request-one',source:'你好，世界。',action:'translate',targetLanguage:'en',lane:'mt',result:{text:'Hello, world.',engine:'MT',key:'must-not-store'}};
  stores.local.settings.analytics=false;assert.equal((await message(entry,site)).ok,true);
  assert.equal((await message({...entry,lane:'llm',result:{text:'Hello, World.',engine:'AI'}},site)).ok,true);
  const data=(await message({type:'get-history'})).data;assert.equal(data.limit,100);assert.equal(data.records.length,1);assert.equal(data.records[0].hostname,'chatgpt.com');assert.equal(data.records[0].source,entry.source);assert.deepEqual(Object.keys(data.records[0].results),['mt','llm']);assert.equal(data.records[0].results.mt.key,undefined);
  assert.equal((await message({type:'get-history'},site)).ok,false);for(const type of ['clear-history','set-history-limit','remove-history'])assert.equal((await message({type,limit:0},site)).ok,false);
  assert.equal((await message(entry,{url:'https://other.test/',tab:{id:3}})).ok,false);
  const exported=(await message({type:'export-config'})).data;assert.ok(!JSON.stringify(exported).includes(entry.source));assert.equal((await message({type:'state'})).data.translationHistory,undefined);
  assert.equal(network.length,0);assert.equal((await message({type:'public-settings'},site)).data.historyLimit,100);
});

test('history clear/disable generations reject late results; rolling limits trim immediately and retain existing records when switched off',async()=>{
  const entry={type:'record-history',generation:0,requestId:'before-clear',source:'固定测试',action:'translate',targetLanguage:'en',lane:'mt',result:{text:'Synthetic test',engine:'MT'}};
  await message(entry,site);await message({type:'clear-history'});assert.equal((await message({...entry,lane:'llm'},site)).data,false);assert.equal((await value('translationHistory')).length,0);
  const generation=stores.local.historyGeneration;for(let i=0;i<55;i++)await message({...entry,generation,requestId:'request-'+i},site);
  await message({type:'set-history-limit',limit:50});assert.equal((await value('translationHistory')).length,50);assert.ok((await value('translationHistory'))[0].id.endsWith('request-54'));
  assert.equal((await message({type:'set-history-limit',limit:999999})).ok,false);
  await message({type:'set-history-limit',limit:0});assert.equal((await value('translationHistory')).length,50);
  assert.equal((await message({...entry,requestId:'disabled',generation:stores.local.historyGeneration},site)).data,false);assert.equal((await value('translationHistory')).length,50);
  await message({type:'set-history-limit',limit:100});const latest=stores.local.historyGeneration;
  await message({...entry,requestId:'new-record',generation:latest},site);const id=(await value('translationHistory'))[0].id;
  await message({type:'remove-history',id});assert.equal((await message({...entry,requestId:'new-record',generation:latest,lane:'llm'},site)).data,false);assert.ok(!(await value('translationHistory')).some(row=>row.id===id));
});

test('fresh install opens first-use authorization; no grant means no consent or network; one completion enables all free features',async()=>{
  stores.local={};opened.length=0;
  await chrome.runtime.onInstalled.listeners[0]({reason:'install'});
  assert.deepEqual(opened,['chrome-extension://unit/welcome.html']);assert.equal(badges.at(-1),'!');
  assert.equal(stores.local.settings.llm.enabled,true);assert.equal(stores.local.settings.llm.consent,false);
  assert.equal((await message({type:'setup-status'})).data.needed,true);
  assert.equal((await message({type:'complete-setup'},site)).ok,false);
  assert.equal((await message({type:'complete-setup'})).ok,false);assert.equal(network.length,0);
  permissions.add('https://*/*');permissions.add('http://*/*');
  assert.equal((await message({type:'complete-setup'})).ok,true);assert.equal(badges.at(-1),'');
  const s=stores.local.settings;assert.equal(s.llm.enabled,true);assert.equal(s.llm.consent,true);assert.equal(s.llm.thinking,false);assert.equal(s.maxWords,3);assert.equal(s.autoSuggest,true);
  for(const id of ['googleweb','bing','microsoft','mymemory'])assert.equal(s.basic[id].consent,false);
  assert.deepEqual(s.siteOrigins,['https://*/*','http://*/*']);assert.equal(network.length,0);
  s.dailyGoal=731;s.llm.enabled=false;permissions.delete('http://*/*');
  assert.equal((await message({type:'setup-status'})).data.needed,true);
  await chrome.permissions.onRemoved.listeners[0]();await message({type:'state'});
  permissions.add('http://*/*');assert.equal((await message({type:'complete-setup'})).ok,true);
  assert.equal(stores.local.settings.dailyGoal,731);assert.equal(stores.local.settings.llm.enabled,false);
});

test('extension updates preserve existing provider choices, consent, website scope and do not open onboarding',async()=>{
  const before=structuredClone(stores.local.settings);opened.length=0;
  await chrome.runtime.onInstalled.listeners[0]({reason:'update'});
  assert.deepEqual(stores.local.settings,before);assert.deepEqual(opened,[]);assert.equal((await message({type:'setup-status'})).data.needed,false);
});

test('restoring a legacy single-site grant does not require broad access or alter provider consent',async()=>{
  const previous=structuredClone(stores.local.settings);permissions.clear();
  assert.deepEqual((await message({type:'setup-status'})).data,{needed:true,initial:false,missing:['https://chatgpt.com/*']});
  assert.equal((await message({type:'complete-setup'})).ok,false);
  permissions.add('https://chatgpt.com/*');assert.equal((await message({type:'complete-setup'})).ok,true);
  assert.deepEqual(stores.local.settings,previous);assert.equal(badges.at(-1),'');assert.equal(permissions.size,1);assert.equal(network.length,0);
});

test('tooltip sizes persist for the granted sender hostname, redact other hosts and never change processing or placement',async()=>{
  stores.local.sitePreferences={'chatgpt.com':{mode:'polish'}};stores.local.tooltipPositions={'chatgpt.com':{x:.2,y:.8}};
  const before=structuredClone(stores.local.settings);assert.equal((await message({type:'public-settings'},site)).data.tooltipSize,'small');
  for(const size of ['small','medium','large']){assert.equal((await message({type:'set-tooltip-size',size,hostname:'victim.test'},site)).ok,true);assert.equal((await message({type:'public-settings'},site)).data.tooltipSize,size);}
  assert.deepEqual(stores.local.tooltipSizes,{'chatgpt.com':'large'});assert.deepEqual(stores.local.tooltipPositions,{'chatgpt.com':{x:.2,y:.8}});assert.deepEqual(stores.local.sitePreferences,{'chatgpt.com':{mode:'polish'}});assert.deepEqual(stores.local.settings,before);assert.equal(network.length,0);
  for(const size of ['huge','__proto__',null,{},['small']])assert.equal((await message({type:'set-tooltip-size',size},site)).ok,false);
  assert.equal((await message({type:'set-tooltip-size',size:'small'})).ok,false);permissions.delete('https://chatgpt.com/*');assert.equal((await message({type:'set-tooltip-size',size:'small'},site)).ok,false);permissions.add('https://chatgpt.com/*');
  stores.local.tooltipSizes=Object.fromEntries(Array.from({length:200},(_,i)=>[`s${i}.test`,'medium']));assert.equal((await message({type:'set-tooltip-size',size:'large'},site)).ok,true);assert.equal(Object.keys(stores.local.tooltipSizes).length,200);assert.equal(stores.local.tooltipSizes['s0.test'],undefined);assert.equal(stores.local.tooltipSizes['chatgpt.com'],'large');
  const publicState=(await message({type:'public-settings'},site)).data;assert.equal(publicState.tooltipSizes,undefined);assert.ok(!JSON.stringify(publicState).includes('s1.test'));
});

test('store build retires experimental web providers and refuses their tests without network',async()=>{
  for(const id of ['googleweb','bing','microsoft']){stores.local.settings.basic[id].consent=true;permissions.add(new URL(stores.local.settings.basic[id].endpoint).origin+'/*');assert.equal((await message({type:'test-basic',id})).ok,false);assert.equal((await message({type:'state'})).data.settings.basic[id].consent,false);}
  assert.equal(network.length,0);
});

test('configuration transfer is trusted-only and never exports credentials, consent or practice data',async()=>{
  stores.session.keys={llm:'synthetic-backup-secret'};stores.local.analytics={private:'not-config'};stores.local.vocabulary=[{word:'private'}];
  stores.local.sitePreferences={'chatgpt.com':{targetLanguage:'zh'}};stores.local.tooltipPositions={'chatgpt.com':{x:.5,y:.4}};
  for(const type of ['export-config','inspect-config','import-config'])assert.equal((await message({type,text:'{}'},site)).ok,false);
  const result=await message({type:'export-config'});assert.equal(result.ok,true);assert.equal(result.data.format,'saywell-configuration');
  const json=JSON.stringify(result.data);for(const forbidden of ['synthetic-backup-secret','not-config','vocabulary','consent','rememberKey'])assert.ok(!json.includes(forbidden));
  assert.deepEqual(result.data.sitePreferences,stores.local.sitePreferences);assert.deepEqual(result.data.tooltipPositions,stores.local.tooltipPositions);assert.equal(network.length,0);
});
test('configuration import replaces preferences, preserves exact-identity keys and practice data, and resets authorization',async()=>{
  await createVault();
  const a={...mergeSettings().llm,id:'default',name:'A',provider:'compatible',endpoint:'https://a.test/v1',model:'a',enabled:true,consent:true,rememberKey:true};
  const b={...a,id:'work',name:'B',endpoint:'https://b.test/v1',rememberKey:false},c={...a,id:'remove',name:'C',endpoint:'https://c.test/v1'};
  stores.local.settings=mergeSettings({siteOrigins:['https://chatgpt.com/*'],llmProfiles:[a,b,c]});stores.local.keys={llm:'keep-local','llm:remove':'remove-local',azure:'keep-azure'};stores.session.keys={'llm:work':'drop-changed'};
  stores.local.settings.basic.azure.rememberKey=true;stores.local.settings.basic.azure.consent=true;
  stores.local.analytics={day:{typed:10}};stores.local.vocabulary=[{word:'keep'}];stores.local.usage={requests:7};stores.local.sitePreferences={'old.test':{mode:'polish'}};
  const incoming=mergeSettings({siteOrigins:['https://chatgpt.com/*','https://new.test/*'],llmProfiles:[{...a,model:'restored'},{...b,endpoint:'https://changed.test/v1'}],activeLlmId:'work',targetLanguage:'zh'});
  const backup=exportConfigBackup(incoming,{uiLanguage:'zh-CN',sitePreferences:{'chatgpt.com':{llmProfileId:'work'}},tooltipPositions:{'chatgpt.com':{x:.2,y:.9}}});
  const result=await message({type:'import-config',text:JSON.stringify(backup)});assert.equal(result.ok,true);assert.equal(result.data.skippedOrigins,1);
  assert.equal(stores.local.settings.activeLlmId,'work');assert.equal(stores.local.settings.llm.endpoint,'https://changed.test/v1');assert.equal(stores.local.settings.targetLanguage,'zh');assert.equal(stores.local.uiLanguage,'zh-CN');
  assert.deepEqual(stores.local.settings.siteOrigins,['https://chatgpt.com/*']);assert.deepEqual((await value('keys')),{llm:'keep-local',azure:'keep-azure'});assert.deepEqual(stores.session.keys,{});
  assert.equal(stores.local.settings.llmProfiles[0].rememberKey,true);assert.equal(stores.local.settings.llmProfiles[1].rememberKey,false);
  for(const config of [...stores.local.settings.llmProfiles,...Object.values(stores.local.settings.basic)])assert.equal(config.consent,false);
  const publicAfterImport=(await message({type:'public-settings'},site)).data;assert.equal(publicAfterImport.llmEnabled,false);assert.equal(publicAfterImport.llmNeedsConnection,true);assert.ok(!JSON.stringify(publicAfterImport).includes('keep-local'));
  assert.deepEqual(stores.local.sitePreferences,backup.sitePreferences);assert.deepEqual(stores.local.tooltipPositions,backup.tooltipPositions);
  assert.deepEqual((await value('analytics')),{day:{typed:10}});assert.deepEqual((await value('vocabulary')),[{word:'keep'}]);assert.deepEqual(stores.local.usage,{requests:7});assert.equal(network.length,0);
});
test('invalid imports leave storage untouched and permission checks run again after preview',async()=>{
  stores.session.keys={llm:'stay'};const before=structuredClone(stores);
  for(const text of ['not-json',JSON.stringify({...exportConfigBackup(stores.local.settings),keys:{llm:'reject'}})]){
    assert.equal((await message({type:'import-config',text})).ok,false);assert.deepEqual(stores,before);
  }
  const backup=exportConfigBackup(stores.local.settings),text=JSON.stringify(backup);
  const preview=await message({type:'inspect-config',text});assert.deepEqual(preview.data.missingOrigins,[]);assert.equal(network.length,0);
  permissions.clear();assert.equal((await message({type:'import-config',text})).data.skippedOrigins,1);assert.deepEqual(stores.local.settings.siteOrigins,[]);
  assert.deepEqual((await message({type:'inspect-config',text})).data.missingOrigins,['https://chatgpt.com/*']);
  permissions.add('https://chatgpt.com/*');await message({type:'import-config',text});assert.deepEqual(stores.local.settings.siteOrigins,['https://chatgpt.com/*']);
  assert.equal(network.length,0);
});
test('website settings are sender-scoped, validated, redacted, and independent of global settings saves',async()=>{
  stores.local.sitePreferences={'other.test':{mode:'explain'}};
  const preference={mode:'translate',targetLanguage:'zh',llmProfileId:null,basicEngine:'mymemory'};
  let reply=await message({type:'set-site-preferences',host:'other.test',preferences:preference},site);assert.equal(reply.ok,true);
  assert.deepEqual(stores.local.sitePreferences,{'other.test':{mode:'explain'},'chatgpt.com':preference});
  assert.deepEqual(reply.data.sitePreferences,preference);assert.equal(reply.data.mode,'translate');assert.equal(reply.data.llmEnabled,false);assert.equal(reply.data.globalDefaults.mode,'auto');
  assert.equal(reply.data.llmChoices[0].endpoint,undefined);assert.equal(reply.data.llmChoices[0].key,undefined);assert.equal(reply.data.llmProfiles,undefined);
  assert.ok(!JSON.stringify(reply).includes('other.test'));assert.equal(stores.local.settings.targetLanguage,'en');
  for(const preferences of [{mode:'invalid'},{endpoint:'https://evil.test'},{llmProfileId:'unknown'},{consent:true}])assert.equal((await message({type:'set-site-preferences',preferences},site)).ok,false);
  assert.equal((await message({type:'save-settings',settings:stores.local.settings})).ok,true);assert.deepEqual(stores.local.sitePreferences['chatgpt.com'],preference);
  reply=await message({type:'public-settings'},{...site,url:'https://chatgpt.com/other-path?private=1'});assert.deepEqual(reply.data.sitePreferences,preference);
  assert.equal((await message({type:'set-site-preferences',preferences:null},site)).ok,true);assert.deepEqual(stores.local.sitePreferences,{'other.test':{mode:'explain'}});
  permissions.clear();assert.equal((await message({type:'set-site-preferences',preferences:preference},site)).ok,false);assert.deepEqual((await message({type:'public-settings'},site)).data.sitePreferences,{});
  assert.equal(network.length,0);
});
test('website-selected LLM uses its own key, target, mode and budget while other hosts follow global defaults',async()=>{
  const a={...mergeSettings().llm,id:'default',name:'Global',enabled:true,consent:true,provider:'compatible',endpoint:'https://a.test/v1',model:'a'};
  const b={...a,id:'work',name:'Work',endpoint:'https://b.test/v1',model:'b',dailyRequests:1};
  stores.local.settings=mergeSettings({siteOrigins:['https://chatgpt.com/*','https://other.test/*'],llmProfiles:[a,b]});
  for(const origin of ['https://a.test/*','https://b.test/*','https://other.test/*'])permissions.add(origin);
  stores.session.keys={llm:'key-a','llm:work':'key-b'};
  await message({type:'set-site-preferences',preferences:{mode:'polish',targetLanguage:'zh',llmProfileId:'work'}},site);
  assert.equal((await message({type:'suggest',lane:'llm',text:'A synthetic sentence.'},site)).ok,true);
  assert.equal(network.at(-1).url,'https://b.test/v1/chat/completions');assert.equal(network.at(-1).opts.headers.Authorization,'Bearer key-b');
  const body=JSON.parse(network.at(-1).opts.body);assert.equal(body.model,'b');assert.match(body.messages[0].content,/Action: polish/);assert.match(body.messages[0].content,/Simplified Chinese/);
  assert.equal((await message({type:'suggest',lane:'llm',text:'Another sentence.'},site)).ok,false);assert.equal(network.length,1);
  const other={...site,url:'https://other.test/'};assert.equal((await message({type:'suggest',lane:'llm',text:'A sentence.'},other)).ok,true);assert.equal(JSON.parse(network.at(-1).opts.body).model,'a');assert.equal(network.at(-1).opts.headers.Authorization,'Bearer key-a');
  assert.deepEqual((await message({type:'public-settings'},other)).data.sitePreferences,{});assert.equal(stores.local.settings.activeLlmId,'default');
  assert.deepEqual(stores.local.usage.profiles,{work:1,default:1});
});
test('website selection never grants provider access, revives blocked sites, or falls back from a deleted LLM profile',async()=>{
  const a={...mergeSettings().llm,id:'default',name:'Global',enabled:true,consent:true,provider:'ollama',endpoint:'https://a.test/v1',model:'a'};
  const b={...a,id:'work',name:'Work',endpoint:'https://b.test/v1',model:'b',consent:false};
  stores.local.settings=mergeSettings({siteOrigins:['https://chatgpt.com/*'],llmProfiles:[a,b]});permissions.add('https://a.test/*');
  assert.equal((await message({type:'set-site-preferences',preferences:{llmProfileId:'work'}},site)).ok,true);
  assert.equal((await message({type:'suggest',lane:'llm',text:'Synthetic.'},site)).ok,false);
  stores.local.settings.llmProfiles[1].consent=true;
  assert.equal((await message({type:'suggest',lane:'llm',text:'Synthetic.'},site)).ok,false);
  permissions.add('https://b.test/*');stores.local.settings.blocklist=['chatgpt.com'];
  assert.equal((await message({type:'suggest',lane:'llm',text:'Synthetic.'},site)).ok,false);
  stores.local.settings.blocklist=[];stores.local.settings.llmProfiles.pop();
  assert.equal((await message({type:'public-settings'},site)).data.llmEnabled,false);assert.equal((await message({type:'suggest',lane:'llm',mode:'polish',text:'Synthetic.'},site)).ok,false);
  assert.equal(network.length,0);
  await message({type:'set-site-preferences',preferences:{llmProfileId:null,mode:'translate',basicEngine:'mymemory',targetLanguage:'zh'}},site);
  stores.local.settings.basic.mymemory.consent=true;permissions.add('https://api.mymemory.translated.net/*');
  assert.equal((await message({type:'suggest',lane:'mt',text:'Hello.'},site)).ok,true);assert.equal(new URL(network.at(-1).url).searchParams.get('langpair'),'en|zh-CN');
});
test('website settings capacity rejects overflow without discarding existing routing preferences',async()=>{
  stores.local.sitePreferences=Object.fromEntries(Array.from({length:300},(_,i)=>[`site${i}.test`,{mode:'polish'}]));
  assert.equal((await message({type:'set-site-preferences',preferences:{mode:'translate'}},site)).ok,false);
  assert.equal(Object.keys(stores.local.sitePreferences).length,300);assert.deepEqual(stores.local.sitePreferences['site0.test'],{mode:'polish'});
});
test('tooltip positions are scoped to the granted sender hostname and persist only coordinates',async()=>{
  stores.local.settings.blocklist=['chatgpt.com'];
  stores.local.tooltipPositions={'other.example':{x:0,y:1}};
  assert.equal((await message({type:'get-tooltip-position',host:'other.example'},site)).data,null);
  assert.equal((await message({type:'set-tooltip-position',host:'other.example',position:{x:0.75,y:0.25,draft:'private text'}},site)).ok,true);
  assert.deepEqual(stores.local.tooltipPositions,{'other.example':{x:0,y:1},'chatgpt.com':{x:0.75,y:0.25}});
  assert.deepEqual((await message({type:'get-tooltip-position'}, {...site,url:'https://chatgpt.com/another-path?secret=1'})).data,{x:0.75,y:0.25});
  for(const position of [{x:2,y:0},{x:'0',y:0},{x:0,y:NaN}])assert.equal((await message({type:'set-tooltip-position',position},site)).ok,false);
  assert.equal((await message({type:'set-tooltip-position',position:null},site)).ok,true);
  assert.deepEqual(stores.local.tooltipPositions,{'other.example':{x:0,y:1}});
  permissions.clear();
  for(const type of ['get-tooltip-position','set-tooltip-position'])assert.equal((await message({type,position:{x:0,y:0}},site)).ok,false);
  assert.equal(network.length,0);assert.equal((await value('analytics')),undefined);
});
test('tooltip preference storage evicts the oldest host and preserves other host positions',async()=>{
  stores.local.tooltipPositions=Object.fromEntries(Array.from({length:200},(_,i)=>[`site${i}.example`,{x:0.5,y:0.5}]));
  await message({type:'set-tooltip-position',position:{x:1,y:0}},site);
  assert.equal(Object.keys(stores.local.tooltipPositions).length,200);
  assert.equal(stores.local.tooltipPositions['site0.example'],undefined);
  assert.deepEqual(stores.local.tooltipPositions['chatgpt.com'],{x:1,y:0});
  assert.deepEqual(stores.local.tooltipPositions['site199.example'],{x:0.5,y:0.5});
});
test('remote text requires site access, provider consent and endpoint permission independently',async()=>{
  const payload={type:'suggest',text:'你好'};
  assert.equal((await message(payload,site)).ok,false);assert.equal(network.length,0);
  stores.local.settings.basic.mymemory.consent=true;assert.equal((await message(payload,site)).ok,false);assert.equal(network.length,0);
  permissions.add('https://api.mymemory.translated.net/*');assert.equal((await message(payload,site)).ok,true);assert.equal(network.length,1);
  permissions.delete('https://chatgpt.com/*');assert.equal((await message(payload,site)).ok,false);assert.equal(network.length,1);
});
test('MyMemory requires text consent and an exact host permission',async()=>{
  stores.local.settings.basicEngine='mymemory';stores.local.settings.basicFallback=false;
  assert.equal((await message({type:'suggest',text:'你好'},site)).ok,false);assert.equal(network.length,0);
  stores.local.settings.basic.mymemory.consent=true;
  assert.equal((await message({type:'suggest',text:'你好'},site)).ok,false);assert.equal(network.length,0);
  permissions.add('https://api.mymemory.translated.net/*');assert.equal((await message({type:'suggest',text:'你好'},site)).ok,true);assert.equal(network.length,1);assert.equal(network[0].opts.headers?.Authorization,undefined);
  assert.ok(!JSON.stringify(stores.session.basicStatus).includes('你好'));
});
test('content scripts cannot read keys or state, change settings, test providers, or reset data',async()=>{
  stores.local.keys={llm:'never-expose'};
  const settings=await message({type:'public-settings'},site);assert.equal(settings.ok,true);assert.ok(!JSON.stringify(settings).includes('never-expose'));assert.ok(!JSON.stringify(settings).includes('endpoint'));
  for(const type of ['state','save-settings','test-llm','test-basic','forget-keys','reset-data'])assert.equal((await message({type},site)).ok,false,type);
  assert.equal(stores.session.keys.llm,'never-expose');assert.equal(stores.local.keys,undefined);
  assert.equal((await message({type:'state'},{...ui,tab:{id:1}})).ok,true,'extension options tabs are trusted by their extension URL');
});
test('excluded websites cannot transmit, learn vocabulary, or increment local statistics',async()=>{
  stores.local.settings.blocklist=['chatgpt.com'];
  assert.equal((await message({type:'suggest',text:'你好'},site)).ok,false);
  assert.equal((await message({type:'vocabulary',item:{word:'test'}},site)).ok,false);
  await message({type:'metric',delta:{typed:10,raw:'secret'}},site);assert.equal((await value('analytics')),undefined);assert.equal(network.length,0);
});
test('a content script can block/unblock only its own granted hostname, never another host or wildcard',async()=>{
  stores.local.settings.blocklist=['*.other.example'];
  let reply=await message({type:'set-site-blocked',blocked:true,host:'victim.example',tabId:999},site);assert.equal(reply.ok,true);
  assert.deepEqual(stores.local.settings.blocklist,['*.other.example','chatgpt.com']);assert.equal(reply.data.siteMode,'blacklist');
  assert.equal((await message({type:'suggest',text:'你好'},site)).ok,false);assert.equal(network.length,0);
  reply=await message({type:'set-site-blocked',blocked:false,host:'*.other.example'},site);assert.equal(reply.ok,true);assert.deepEqual(stores.local.settings.blocklist,['*.other.example']);
  assert.equal((await message({type:'set-site-blocked',blocked:true,tabId:2},ui)).ok,true);assert.ok(stores.local.settings.blocklist.includes('chatgpt.com'));
  assert.equal((await message({type:'set-site-blocked',blocked:true,tabId:99},ui)).ok,false);
  stores.local.settings.blocklist=['*.chatgpt.com'];await message({type:'set-site-blocked',blocked:false},site);assert.deepEqual(stores.local.settings.blocklist,['*.chatgpt.com']);
  permissions.delete('https://chatgpt.com/*');assert.equal((await message({type:'set-site-blocked',blocked:true},site)).ok,false);
  assert.equal((await message({type:'set-site-mode',mode:'whitelist'},site)).ok,false);
});
test('whitelist requests and counters are denied until the hostname is explicitly listed',async()=>{
  stores.local.settings.siteMode='whitelist';stores.local.settings.basic.mymemory.consent=true;permissions.add('https://api.mymemory.translated.net/*');
  assert.equal((await message({type:'suggest',text:'你好'},site)).ok,false);await message({type:'metric',delta:{typed:1}},site);assert.equal((await value('analytics')),undefined);
  assert.equal((await message({type:'set-site-blocked',blocked:true},site)).ok,false);
  stores.local.settings.allowlist=['chatgpt.com'];assert.equal((await message({type:'suggest',text:'你好'},site)).ok,true);
  const saved=await message({type:'set-site-mode',mode:'blacklist'});assert.equal(saved.ok,true);assert.deepEqual(stores.local.settings.allowlist,['chatgpt.com']);
});
test('daily LLM limit counts attempts and blocks subsequent requests before network',async()=>{
  stores.local.settings.llm={...stores.local.settings.llm,enabled:true,consent:true,endpoint:'https://llm.test/v1',model:'test',dailyRequests:1};stores.session.keys={llm:'synthetic-key'};permissions.add('https://llm.test/*');
  const request={type:'suggest',text:'This are correct.'};assert.equal((await message(request,site)).ok,true);assert.equal(network.length,1);
  const next=await message(request,site);assert.equal(next.ok,false);assert.match(next.error,/daily LLM request limit/);assert.equal(network.length,1);
  const publicState=await message({type:'state'});assert.ok(!JSON.stringify(publicState).includes('synthetic-key'));
});
test('new LLM providers require separate consent and host grants; switching drops credentials',async()=>{
  for(const provider of ['mimo','siliconflow']){
    const preset=LLM_PROVIDERS[provider],origin=new URL(preset.endpoint).origin+'/*';
    const s=mergeSettings({llm:{enabled:true,provider,endpoint:preset.endpoint,model:preset.example}});
    let reply=await message({type:'save-settings',settings:s,keys:{llm:'synthetic-new-key'}});assert.equal(reply.ok,true);
    const before=network.length;assert.equal((await message({type:'test-llm'})).ok,false);assert.equal(network.length,before);
    s.llm.consent=true;reply=await message({type:'save-settings',settings:s});assert.equal(reply.ok,false);assert.equal(network.length,before);
    permissions.add(origin);assert.equal((await message({type:'save-settings',settings:s})).ok,true);
    reply=await message({type:'test-llm'});assert.equal(reply.ok,true);assert.equal(reply.data.engine,preset.name);
    assert.equal(network.at(-1).url,preset.endpoint+'/chat/completions');
    assert.ok(!JSON.stringify(await message({type:'state'})).includes('synthetic-new-key'));
    assert.ok(!JSON.stringify(await message({type:'public-settings'},site)).includes('synthetic-new-key'));
    assert.equal((await value('keys'))?.llm,undefined);assert.equal(stores.session.keys.llm,'synthetic-new-key');
    s.llm.endpoint='https://other.test/v1';s.llm.consent=false;await message({type:'save-settings',settings:s});assert.equal(stores.session.keys.llm,'');
  }
});

test('key storage defaults to session, persistence is explicit, endpoints cannot reuse old keys',async()=>{
  const s=mergeSettings();const saved=await message({type:'save-settings',settings:s,keys:{llm:'session-key'}});assert.equal(saved.ok,true);
  assert.equal((await value('keys'))?.llm,undefined);assert.equal(stores.session.keys.llm,'session-key');
  s.llm.rememberKey=true;assert.equal((await message({type:'save-settings',settings:s})).ok,false);await createVault();await message({type:'save-settings',settings:s});assert.equal((await value('keys')).llm,'session-key');assert.equal(stores.session.keys.llm,undefined);
  s.llm.endpoint='https://new.test/v1';await message({type:'save-settings',settings:s});assert.equal((await value('keys')).llm,'');
});

test('LLM configurations isolate keys, consent and active routing; tests never activate or leak keys',async()=>{
  await createVault();
  const a={...mergeSettings().llm,id:'default',name:'Personal',enabled:true,consent:true,provider:'compatible',endpoint:'https://a.test/v1',model:'model-a'};
  const b={...a,id:'work',name:'Work',endpoint:'https://b.test/v1',model:'model-b',rememberKey:true};
  permissions.add('https://a.test/*');permissions.add('https://b.test/*');
  let reply=await message({type:'save-settings',settings:mergeSettings({siteOrigins:['https://chatgpt.com/*'],llmProfiles:[a,b]}),profileKeys:{default:'synthetic-a',work:'synthetic-b'}});assert.equal(reply.ok,true);
  assert.equal(stores.session.keys.llm,'synthetic-a');assert.equal((await value('keys'))['llm:work'],'synthetic-b');
  assert.equal((await message({type:'suggest',text:'This are a test.'},site)).ok,true);assert.equal(JSON.parse(network.at(-1).opts.body).model,'model-a');assert.equal(network.at(-1).opts.headers.Authorization,'Bearer synthetic-a');
  assert.equal((await message({type:'activate-llm-profile',profileId:'work'},site)).ok,false);
  assert.equal((await message({type:'activate-llm-profile',profileId:'work'})).ok,true);
  assert.equal((await message({type:'suggest',text:'Another test.'},site)).ok,true);assert.equal(JSON.parse(network.at(-1).opts.body).model,'model-b');assert.equal(network.at(-1).opts.headers.Authorization,'Bearer synthetic-b');
  assert.equal((await message({type:'test-llm',profileId:'default'})).ok,true);assert.equal(JSON.parse(network.at(-1).opts.body).model,'model-a');
  let state=(await message({type:'state'})).data;assert.equal(state.settings.activeLlmId,'work');assert.deepEqual(state.hasProfileKeys,{default:true,work:true});assert.ok(!JSON.stringify(state).includes('synthetic-a'));assert.ok(!JSON.stringify(state).includes('synthetic-b'));
  const publicState=(await message({type:'public-settings'},site)).data;assert.equal(publicState.llmProfiles,undefined);assert.equal(publicState.activeLlmId,undefined);
  state.settings.llmProfiles[0].endpoint='https://changed.test/v1';state.settings.llmProfiles[0].consent=false;
  assert.equal((await message({type:'save-settings',settings:state.settings})).ok,true);assert.equal(stores.session.keys.llm,'');assert.equal((await value('keys'))['llm:work'],'synthetic-b');
  state=(await message({type:'state'})).data;state.settings.llmProfiles=state.settings.llmProfiles.filter(p=>p.id!=='work');state.settings.activeLlmId='default';state.settings.llm=llmConfig(state.settings.llmProfiles[0]);
  assert.equal((await message({type:'save-settings',settings:state.settings})).ok,true);assert.equal((await value('keys'))['llm:work'],undefined);
});

test('configuration request caps are independent and invalid inactive endpoints cannot be authorized',async()=>{
  const a={...mergeSettings().llm,id:'default',name:'A',enabled:true,consent:true,provider:'ollama',endpoint:'https://a.test/v1',model:'a',dailyRequests:1};
  const b={...a,id:'second',name:'B',endpoint:'https://b.test/v1',model:'b'};
  permissions.add('https://a.test/*');permissions.add('https://b.test/*');
  let s=mergeSettings({siteOrigins:['https://chatgpt.com/*'],llmProfiles:[a,b]});assert.equal((await message({type:'save-settings',settings:s})).ok,true);
  assert.equal((await message({type:'test-llm'})).ok,true);assert.equal((await message({type:'test-llm'})).ok,false);
  assert.equal((await message({type:'test-llm',profileId:'second'})).ok,true);assert.equal(stores.local.usage.requests,2);
  s=(await message({type:'state'})).data.settings;s.llmProfiles[1].endpoint='https://ungranted.test/v1';
  assert.equal((await message({type:'save-settings',settings:s})).ok,false);
});
test('saved vocabulary never retains context without explicit opt-in and analytics discard raw data',async()=>{
  await message({type:'vocabulary',item:{word:'streamline',meaning:'精简'},context:'private source sentence'},site);assert.equal((await value('vocabulary'))[0].context,undefined);
  await message({type:'vocabulary',item:{word:'workflow'},context:'synthetic sentence',includeContext:true},site);assert.equal((await value('vocabulary'))[0].context,'synthetic sentence');
  await message({type:'metric',delta:{typed:12,raw:'never-store-me'}},site);assert.ok(!JSON.stringify((await value('analytics'))).includes('never-store-me'));
});

test('parallel lanes use only their independently authorized providers and never serialize network fetches',async()=>{
  stores.local.settings.basic.mymemory.consent=true;permissions.add('https://api.mymemory.translated.net/*');permissions.add('https://llm.test/*');
  stores.local.settings.llm={...stores.local.settings.llm,enabled:true,consent:true,endpoint:'https://llm.test/v1',model:'fixture'};stores.session.keys={llm:'synthetic'};
  const original=globalThis.fetch;let release;const gate=new Promise(resolve=>{release=resolve;});
  globalThis.fetch=async(url,opts)=>{if(url.includes('llm.test'))await gate;return original(url,opts);};
  try{
    let llmDone=false;const llm=message({type:'suggest',lane:'llm',text:'你好。'},site).then(r=>{llmDone=true;return r;});
    const mt=await message({type:'suggest',lane:'mt',text:'你好。'},site);assert.equal(mt.ok,true);assert.equal(mt.data.category,'basic');assert.equal(llmDone,false);
    release();assert.equal((await llm).data.category,'llm');
    permissions.delete('https://api.mymemory.translated.net/*');assert.equal((await message({type:'suggest',lane:'mt',text:'你好。'},site)).ok,false);
    assert.equal((await message({type:'suggest',lane:'llm',text:'你好。'},site)).ok,true);
    assert.equal((await message({type:'set-target-language',targetLanguage:'zh'},site)).ok,false);
    assert.equal((await message({type:'set-target-language',targetLanguage:'zh'})).ok,true);assert.equal((await message({type:'public-settings'},site)).data.targetLanguage,'zh');
  }finally{release();globalThis.fetch=original;}
});
