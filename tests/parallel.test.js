import test from 'node:test';import assert from 'node:assert/strict';
import {mergeSettings,validateSettings,publicSettings} from '../src/core/settings.js';
import {routeAction,translationPair} from '../src/core/language.js';
import {thinkingOptions,geminiThinking} from '../src/providers/thinking.js';
import {processLLM,systemPrompt} from '../src/providers/llm.js';
import {createBasicProviders} from '../src/providers/basic.js';
import {builtin} from '../src/providers/builtin.js';
const response=body=>new Response(JSON.stringify(body));

test('thinking defaults off in every old/new profile; target defaults to English and validates',()=>{
  const s=mergeSettings({llmProfiles:[{id:'default',name:'Old'},{id:'other',name:'Second'}]});
  assert.equal(s.targetLanguage,'en');for(const p of s.llmProfiles){assert.equal(p.thinking,false);assert.equal(p.thinkingProtocol,'auto');}
  assert.equal(publicSettings({...s,targetLanguage:'zh'}).targetLanguage,'zh');
  assert.throws(()=>validateSettings({...s,targetLanguage:'fr'}),/targetLanguage/);
  s.llm.thinking='false';assert.throws(()=>validateSettings(s),/configuration/);
});

test('thinking switches are provider-specific, explicit off/on, and compatible endpoints can override protocol',()=>{
  const cfg=mergeSettings({llm:{}}).llm;
  for(const[provider,off,on]of [
    ['mimo',{thinking:{type:'disabled'}},{thinking:{type:'enabled'}}],
    ['deepseek',{thinking:{type:'disabled'}},{thinking:{type:'enabled'}}],
    ['siliconflow',{enable_thinking:false},{enable_thinking:true}],
    ['ollama',{reasoning_effort:'none'},{reasoning_effort:'medium'}]
  ]){
    assert.deepEqual(thinkingOptions({...cfg,provider,model:'fixture'}),off);assert.deepEqual(thinkingOptions({...cfg,provider,model:'fixture',thinking:true}),on);
  }
  assert.deepEqual(thinkingOptions({...cfg,endpoint:'https://api.siliconflow.cn/v1',model:'Qwen/test'}),{enable_thinking:false});
  assert.deepEqual(thinkingOptions({...cfg,endpoint:'https://custom.test/v1',model:'gpt-4o'}),{});
  assert.deepEqual(thinkingOptions({...cfg,endpoint:'https://custom.test/v1',model:'qwen3',thinkingProtocol:'chat_template'}),{chat_template_kwargs:{enable_thinking:false}});
  assert.deepEqual(thinkingOptions({...cfg,provider:'openai',model:'gpt-5.1'}),{reasoning_effort:'none'});
  assert.deepEqual(geminiThinking({...cfg,model:'gemini-2.5-flash'}),{thinkingConfig:{thinkingBudget:0}});
  for(const model of ['o3','gpt-5','gpt-6-astra'])assert.throws(()=>thinkingOptions({...cfg,provider:'openai',model}),/cannot disable/);
  assert.throws(()=>geminiThinking({...cfg,model:'gemini-3-flash'}),/cannot disable/);
});

test('target changes routing and provider prompts, Chinese output omits English vocabulary',async()=>{
  assert.equal(routeAction('Hello.','auto',true,'zh').action,'translate');assert.equal(routeAction('你好。','auto',true,'zh').action,'polish');assert.equal(routeAction('你好。','auto',false,'zh').action,'none');
  assert.deepEqual(translationPair('Hello.','zh'),{source:'en',target:'zh'});assert.deepEqual(translationPair('你好。','en'),{source:'zh',target:'en'});
  const req={action:'translate',style:'natural',difficulty:'intermediate',maxWords:3,targetLanguage:'zh',known:[]};
  assert.match(systemPrompt(req),/Target language: Simplified Chinese/);
  let body;const result=await processLLM('Hello.',{...mergeSettings().llm,provider:'siliconflow',endpoint:'https://api.test/v1',model:'test',key:'synthetic'},req,async(_url,opts)=>{body=JSON.parse(opts.body);return response({choices:[{message:{content:'{"text":"你好。","vocabulary":[{"word":"你好","meaning":"hello"}]}'}}]});});
  assert.equal(body.enable_thinking,false);assert.match(body.messages[0].content,/Simplified Chinese/);assert.equal(result.text,'你好。');assert.deepEqual(result.vocabulary,[]);
});

test('all MT adapters send the English-to-Chinese pair rather than hardcoded Chinese-to-English',async()=>{
  const calls=[];const providers=createBasicProviders({fetcher:async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/translator'))return new Response('var params_AbusePreventionHelper = [123,"synthetic",600000]; IG:"ABC123", <div id="rich_tta" data-iid="translator.1">');if(url.includes('/translate_a/single'))return response([[['你好。','Hello.']]]);if(url.includes('/ttranslatev3'))return response([{translations:[{text:'你好。',to:'zh-Hans'}]}]);if(url.includes('/get'))return response({responseStatus:200,responseData:{translatedText:'你好。'}});if(url.includes('/languages'))return response([{code:'en',targets:['zh']}]);if(url.includes('/language/translate/v2'))return response({data:{translations:[{translatedText:'你好。'}]}});if(url.includes('/translate/translatetext'))return response([{translations:[{text:'你好。',to:'zh-CHS'}]}]);if(url.includes('api-version'))return response([{translations:[{text:'你好。'}]}]);return response({translatedText:'你好。'});}});
  const cfg={endpoint:'https://test.example',key:'synthetic'},pair={source:'en',target:'zh'};
  for(const p of providers){assert.equal(await p.available(cfg,pair),true);assert.equal((await p.translate('Hello.',cfg,pair)).text,'你好。');}
  assert.equal(new URL(calls.find(c=>c.url.includes('/get')).url).searchParams.get('langpair'),'en|zh-CN');
  const libre=JSON.parse(calls.find(c=>c.url.endsWith('/translate')).opts.body);assert.equal(libre.source,'en');assert.equal(libre.target,'zh');
  const google=JSON.parse(calls.find(c=>c.url.includes('/language/translate/v2')).opts.body);assert.equal(google.target,'zh');
  const azure=new URL(calls.find(c=>c.url.includes('api-version')).url);assert.equal(azure.searchParams.get('from'),'en');assert.equal(azure.searchParams.get('to'),'zh-Hans');
});

test('local translator caches directions separately when target changes',async()=>{
  const original=globalThis.Translator,calls=[];builtin.translators.clear();
  globalThis.Translator={availability:async()=>'available',create:async pair=>{calls.push(pair);return{translate:async()=>pair.targetLanguage==='en'?'Hello.':'你好。'};}};
  try{assert.equal((await builtin.translate('你好。',{source:'zh',target:'en'})).text,'Hello.');assert.equal((await builtin.translate('Hello.',{source:'en',target:'zh'})).text,'你好。');assert.equal(calls.length,2);}finally{globalThis.Translator=original;builtin.translators.clear();}
});
