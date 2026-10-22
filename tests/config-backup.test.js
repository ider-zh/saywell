import test from 'node:test';import assert from 'node:assert/strict';
import {mergeSettings,builtinLlmProfile} from '../src/core/settings.js';
import {HOSTED_AI_ENDPOINT,LEGACY_HOSTED_AI_ENDPOINT,HOSTED_AI_MODEL} from '../src/core/hosted-ai.js';
import {CONFIG_FILE_LIMIT,exportConfigBackup,parseConfigBackup,configSummary} from '../src/core/config-backup.js';
const file=()=>exportConfigBackup(mergeSettings({llm:{provider:'compatible',endpoint:'https://custom.test/v1',model:'custom'}}));

test('backups omit built-in service data and restore app-owned defaults while preserving profile references',()=>{
  const builtin=builtinLlmProfile(),custom={...builtin,id:'work',name:'Work',provider:'compatible',endpoint:'https://custom.test/v1',model:'custom'};
  const backup=exportConfigBackup(mergeSettings({llmProfiles:[builtin,custom]}),{sitePreferences:{'x.com':{llmProfileId:'default'}}});
  assert.equal(backup.version,2);assert.deepEqual(backup.builtinLlmIds,['default']);assert.equal(backup.settings.llmProfiles.length,1);assert.ok(!JSON.stringify(backup).includes(HOSTED_AI_ENDPOINT));assert.ok(!JSON.stringify(backup).includes(HOSTED_AI_MODEL));
  const restored=parseConfigBackup(JSON.stringify(backup));assert.equal(restored.settings.llm.endpoint,HOSTED_AI_ENDPOINT);assert.equal(restored.settings.llm.model,HOSTED_AI_MODEL);assert.equal(restored.settings.llm.consent,false);assert.equal(restored.settings.llmProfiles[1].endpoint,'https://custom.test/v1');assert.equal(restored.sitePreferences['x.com'].llmProfileId,'default');
  const only=exportConfigBackup(mergeSettings());assert.deepEqual(only.settings.llmProfiles,[]);assert.equal(parseConfigBackup(JSON.stringify(only)).settings.llm.provider,'saywell');
  const legacy={...only,version:1,settings:{...only.settings,llmProfiles:[{...builtin,endpoint:LEGACY_HOSTED_AI_ENDPOINT,model:'old-model',maxTokens:100}]}};delete legacy.builtinLlmIds;delete legacy.settings.llmProfiles[0].consent;delete legacy.settings.llmProfiles[0].rememberKey;
  const current=parseConfigBackup(JSON.stringify(legacy)).settings.llm;assert.equal(current.endpoint,HOSTED_AI_ENDPOINT);assert.equal(current.model,HOSTED_AI_MODEL);assert.equal(current.maxTokens,800);
  delete legacy.settings.llmProfiles[0].id;assert.throws(()=>parseConfigBackup(JSON.stringify(legacy)),/Invalid LLM configurations/);
  for(const refs of [['default','default'],['bad/id'],Array.from({length:21},(_,i)=>'p'+i)])assert.throws(()=>parseConfigBackup(JSON.stringify({...only,builtinLlmIds:refs})));
});

test('configuration backups preserve bounded website sizes and restore old files with default sizing',()=>{
  const backup=exportConfigBackup(mergeSettings(),{tooltipSizes:{'ChatGPT.com':'large','x.com':'small'}});assert.deepEqual(backup.tooltipSizes,{'chatgpt.com':'large','x.com':'small'});assert.deepEqual(parseConfigBackup(JSON.stringify(backup)).tooltipSizes,backup.tooltipSizes);
  delete backup.tooltipSizes;assert.deepEqual(parseConfigBackup(JSON.stringify(backup)).tooltipSizes,{});
  for(const value of [{'x.com':'huge'},{'x.com':['small']},{'x.com/path':'small'},Object.fromEntries(Array.from({length:201},(_,i)=>[`s${i}.test`,'small']))])assert.throws(()=>parseConfigBackup(JSON.stringify({...backup,tooltipSizes:value})));
});

test('configuration backup round-trips global/profile/site/placement preferences without credentials or consent',()=>{
  const s=mergeSettings({targetLanguage:'zh',mode:'polish',llm:{provider:'mimo',endpoint:'https://api.example/v1',model:'model-a',consent:true,rememberKey:true,enabled:true}});
  s.llmProfiles[0].key='never-export-this';s.keys={llm:'never-export-this'};s.basic.azure.key='azure-secret';
  s.llmProfiles.push({...s.llmProfiles[0],id:'work',name:'Work',model:'model-b'});
  const backup=exportConfigBackup(s,{uiLanguage:'zh-CN',sitePreferences:{'chatgpt.com':{llmProfileId:'work',mode:'translate'}},tooltipPositions:{'chatgpt.com':{x:.2,y:.8}},analytics:{raw:'not-config'}});
  const json=JSON.stringify(backup);for(const forbidden of ['never-export-this','azure-secret','rememberKey','consent','not-config','"llm":'])assert.ok(!json.includes(forbidden),forbidden);assert.equal(backup.analytics,undefined);
  const restored=parseConfigBackup(json);assert.equal(restored.settings.mode,'polish');assert.equal(restored.settings.targetLanguage,'zh');assert.equal(restored.uiLanguage,'zh-CN');assert.equal(restored.settings.llm.model,'model-a');assert.equal(restored.settings.llmProfiles.length,2);
  assert.equal(restored.settings.llm.consent,false);assert.equal(restored.settings.llm.rememberKey,false);assert.deepEqual(restored.sitePreferences,backup.sitePreferences);assert.deepEqual(restored.tooltipPositions,backup.tooltipPositions);
  assert.equal(configSummary(restored).profiles.length,2);assert.equal(configSummary(restored).sites,1);
});
test('configuration files reject unsupported versions, malformed data, secret fields and unsafe endpoints',()=>{
  for(const text of ['not JSON','[]','{}',JSON.stringify({...file(),version:99}),JSON.stringify({schemaVersion:1,analytics:{}})])assert.throws(()=>parseConfigBackup(text));
  for(const mutate of [
    b=>{b.keys={llm:'secret'};},b=>{b.settings.keys={llm:'secret'};},b=>{b.settings.llmProfiles[0].key='secret';},b=>{b.settings.basic.google.key='secret';},
    b=>{b.settings.llmProfiles[0].consent=true;},b=>{b.settings.basic.mymemory.rememberKey=true;},b=>{b.settings.enabled='true';},b=>{b.settings.llmProfiles=[];},b=>{b.settings.llmProfiles=Array.from({length:21},()=>({}));},
    b=>{b.settings.llmProfiles[0].endpoint='https://example.test/v1?key=secret';},b=>{b.settings.llmProfiles[0].endpoint='http://remote.test/v1';},
    b=>{b.settings.basic.google.endpoint=null;},b=>{b.settings.basic.libre.endpoint=false;},b=>{b.settings.basic.azure.endpoint=42;},b=>{b.settings.basic.libre.endpoint='https://example.test/'+'x'.repeat(500);},
    b=>{b.settings.siteOrigins=['https://victim.test.evil/path'];},b=>{b.settings.blocklist=['evil.test/path'];},b=>{b.uiLanguage='unknown';}
  ]){const backup=file();mutate(backup);assert.throws(()=>parseConfigBackup(JSON.stringify(backup)));}
});
test('configuration maps validate exact hostnames, numeric positions, bounded counts and size',()=>{
  for(const mutate of [
    b=>{b.sitePreferences={'other.test/path':{mode:'translate'}};},b=>{b.sitePreferences={'*.other.test':{mode:'translate'}};},
    b=>{b.sitePreferences={'other.test':{endpoint:'https://other.test'}};},b=>{b.tooltipPositions={'other.test':{x:2,y:0}};},
    b=>{b.tooltipPositions={'other.test':{x:0,y:0,draft:'private'}};},b=>{b.sitePreferences=Object.fromEntries(Array.from({length:301},(_,i)=>[`s${i}.test`,{}]));},
    b=>{b.tooltipPositions=Object.fromEntries(Array.from({length:201},(_,i)=>[`s${i}.test`,{x:0,y:0}]));}
  ]){const backup=file();mutate(backup);assert.throws(()=>parseConfigBackup(JSON.stringify(backup)));}
  assert.throws(()=>parseConfigBackup('a'.repeat(CONFIG_FILE_LIMIT+1)),/too large/);
  const backup=file();backup.sitePreferences={'ChatGPT.com':{llmProfileId:'removed'}};backup.settings.siteOrigins=['https://*/*','http://localhost:8080/*'];
  assert.deepEqual(parseConfigBackup(JSON.stringify(backup)).sitePreferences,{'chatgpt.com':{llmProfileId:'removed'}});
});
