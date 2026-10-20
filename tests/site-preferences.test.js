import test from 'node:test';import assert from 'node:assert/strict';
import {validateSitePreferences,sitePreferencesFor,resolveSiteSettings} from '../src/core/site-preferences.js';
import {mergeSettings} from '../src/core/settings.js';

test('website preferences inherit field by field and select a profile without changing global state',()=>{
  const s=mergeSettings(),profile={...s.llmProfiles[0],id:'work',name:'Work',provider:'mimo',endpoint:'https://work.test/v1',model:'site-model',consent:true,enabled:true};s.llmProfiles.push(profile);
  const preferences=validateSitePreferences({mode:'polish',targetLanguage:'zh',llmProfileId:'work',basicEngine:'microsoft'},s.llmProfiles),effective=resolveSiteSettings(s,preferences);
  assert.equal(effective.mode,'polish');assert.equal(effective.targetLanguage,'zh');assert.equal(effective.llm.model,'site-model');assert.equal(effective.activeLlmId,'work');assert.equal(effective.basicEngine,'microsoft');
  assert.equal(effective.basicFallback,s.basicFallback);assert.deepEqual(effective.siteOrigins,s.siteOrigins);
  assert.equal(s.activeLlmId,'default');assert.equal(s.targetLanguage,'en');assert.equal(s.llm.enabled,true);
  assert.deepEqual(resolveSiteSettings(s,{}),s);
});
test('website preferences accept only enumerated fields, exact profiles and safe IDs',()=>{
  const profiles=mergeSettings().llmProfiles;
  for(const value of [null,[],{endpoint:'https://other.test'},{consent:true},{key:'secret'},{mode:'bad'},{targetLanguage:'fr'},{basicEngine:'unknown'},{llmProfileId:'missing'},{llmProfileId:'__proto__'}])assert.throws(()=>validateSitePreferences(value,profiles));
  assert.deepEqual(validateSitePreferences({llmProfileId:null},profiles),{llmProfileId:null});
  assert.deepEqual(sitePreferencesFor({'site.test':{mode:'translate'}},'other.test'),{});
  assert.deepEqual(sitePreferencesFor({'site.test':{mode:'bad'}},'site.test'),{});
});
test('MT-only and removed website configurations disable LLM rather than using another provider',()=>{
  const s=mergeSettings({llm:{enabled:true,consent:true,endpoint:'https://global.test/v1',model:'global'}});
  assert.equal(resolveSiteSettings(s,{llmProfileId:null}).llm.enabled,false);
  const effective=resolveSiteSettings(s,sitePreferencesFor({'site.test':{llmProfileId:'removed',mode:'translate'}},'site.test'));
  assert.equal(effective.llm.enabled,false);assert.equal(effective.llm.endpoint,'');assert.equal(effective.activeLlmId,'removed');assert.equal(effective.mode,'translate');
});
