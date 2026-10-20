import test from 'node:test';import assert from 'node:assert/strict';
import {processLLM} from '../src/providers/llm.js';import {mergeSettings} from '../src/core/settings.js';import {HOSTED_AI_ENDPOINT,HOSTED_AI_MODEL,LEGACY_HOSTED_AI_ENDPOINT} from '../src/core/hosted-ai.js';
const request={action:'translate',style:'natural',targetLanguage:'en',difficulty:'intermediate',maxWords:0,known:[]};

test('new installs offer keyless Saywell AI without consent while saved LLM choices remain intact',()=>{
  const fresh=mergeSettings();assert.equal(fresh.llm.provider,'saywell');assert.equal(fresh.llm.endpoint,HOSTED_AI_ENDPOINT);assert.equal(fresh.llm.model,HOSTED_AI_MODEL);assert.equal(fresh.llm.enabled,true);assert.equal(fresh.llm.consent,false);assert.equal(fresh.llm.thinking,false);
  const old=mergeSettings({llm:{provider:'compatible',endpoint:'https://custom.test/v1',model:'saved'}});assert.equal(old.llm.provider,'compatible');assert.equal(old.llm.model,'saved');
  const legacy=mergeSettings({llm:{...fresh.llm,endpoint:LEGACY_HOSTED_AI_ENDPOINT,consent:true}});assert.equal(legacy.llm.endpoint,LEGACY_HOSTED_AI_ENDPOINT);assert.equal(legacy.llm.consent,true);
});

test('Saywell adapter sends only the bounded coach schema without a key, prompt, arbitrary model or vocabulary history',async()=>{
  let sent;const cfg={...mergeSettings().llm,maxTokens:8000,key:'must-not-send'};
  const result=await processLLM('你好。',cfg,request,async(url,options)=>{sent={url,options};return new Response(JSON.stringify({result:{text:'Hello.',vocabulary:[]},usage:{total_tokens:42}}));});
  const body=JSON.parse(sent.options.body);assert.equal(sent.url,HOSTED_AI_ENDPOINT+'/coach');assert.equal(body.maxTokens,800);assert.equal(body.thinking,false);assert.equal(body.model,undefined);assert.equal(body.messages,undefined);assert.equal(body.known,undefined);assert.equal(sent.options.headers.Authorization,undefined);assert.equal(sent.options.credentials,'omit');assert.equal(result.engine,'Saywell Free AI');assert.equal(result.text,'Hello.');
});

test('Saywell quota, busy and prerelease cutoff errors become actionable messages without echoing server content',async()=>{
  for(const[code,status,expected]of [['daily_quota_exhausted',429,'quota'],['temporarily_busy',429,'rate'],['preview_ended',503,'unavailable'],['inference_unavailable',503,'unavailable']]){
    await assert.rejects(processLLM('你好。',mergeSettings().llm,request,async()=>new Response(JSON.stringify({error:{code,detail:'private server content'}}),{status,headers:{'Retry-After':'3600'}})),error=>error.code===expected&&!error.message.includes('private')&&(expected!=='quota'||error.message.includes('08:00')));
  }
});
