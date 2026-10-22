import test from 'node:test';import assert from 'node:assert/strict';
import {mergeSettings} from '../src/core/settings.js';
import {mergeSettingsEdits} from '../src/core/settings-edits.js';
const fixture=()=>mergeSettings({llm:{provider:'compatible',endpoint:'https://a.example/v1',model:'synthetic'}});
test('settings edits preserve concurrent popup choices and merge hostname membership changes',()=>{
  const base=fixture(),local=structuredClone(base),current=structuredClone(base);base.blocklist=['old.example'];local.blocklist=['local.example'];current.blocklist=['old.example','external.example'];
  local.dailyGoal=500;current.targetLanguage='zh';current.enabled=false;
  const result=mergeSettingsEdits(base,local,current);assert.equal(result.dailyGoal,500);assert.equal(result.targetLanguage,'zh');assert.equal(result.enabled,false);assert.deepEqual(result.blocklist,['external.example','local.example']);
});
test('profile merges preserve concurrent activation and authorization revocation',()=>{
  const base=fixture();base.llmProfiles[0].consent=true;const local=structuredClone(base),current=structuredClone(base);
  local.llmProfiles[0].name='Edited name';current.llmProfiles[0].consent=false;current.llmProfiles.push({...current.llmProfiles[0],id:'work',name:'Work'});current.activeLlmId='work';
  const result=mergeSettingsEdits(base,local,current);assert.equal(result.llmProfiles[0].name,'Edited name');assert.equal(result.llmProfiles[0].consent,false);assert.equal(result.activeLlmId,'work');assert.equal(result.llm.consent,false);
});
test('a connection action cannot authorize or remember credentials for an externally changed identity',()=>{
  const base=fixture(),current=structuredClone(base);current.llmProfiles[0].endpoint='https://b.example/v1';current.llmProfiles[0].consent=true;
  for(const change of [{consent:true},{rememberKey:true},{model:'local-model'},{thinkingProtocol:'reasoning_effort'}]){const local=structuredClone(base);Object.assign(local.llmProfiles[0],change);assert.throws(()=>mergeSettingsEdits(base,local,current),/Settings changed/);}
  const local=structuredClone(base);local.llmProfiles[0].endpoint='https://c.example/v1';local.llmProfiles[0].consent=false;
  assert.equal(mergeSettingsEdits(base,local,current).llmProfiles[0].consent,false);
});
test('an externally deleted profile is not revived by unrelated autosave and edited deletions conflict',()=>{
  const base=fixture();base.llmProfiles.push({...base.llmProfiles[0],id:'work',name:'Work'});const local=structuredClone(base),current=structuredClone(base);current.llmProfiles.pop();local.dailyGoal=500;
  assert.equal(mergeSettingsEdits(base,local,current).llmProfiles.length,1);local.llmProfiles[1].model='new-model';assert.throws(()=>mergeSettingsEdits(base,local,current),/Settings changed/);
});
