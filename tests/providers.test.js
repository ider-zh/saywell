import test from 'node:test';import assert from 'node:assert/strict';
import {createBasicProviders,normalizeBasic} from '../src/providers/basic.js';
import {BasicRouter} from '../src/providers/router.js';
import {fetchJSON,ProviderError} from '../src/providers/http.js';
import {parseLLM,processLLM} from '../src/providers/llm.js';
import {mergeSettings} from '../src/core/settings.js';
import {LLM_PROVIDERS} from '../src/core/llm-providers.js';
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const config=()=>mergeSettings({basic:{mymemory:{consent:true},libre:{consent:true,endpoint:'https://libre.test'}}});
test('Microsoft Edge needs no token or credentials and posts the tested string-array contract',async()=>{
  let request;const provider=createBasicProviders({fetcher:async(url,opts)=>{request={url,opts};return response([{translations:[{text:'Hello, World.',to:'en'}]}]);}}).find(p=>p.id==='microsoft');
  const result=await provider.translate('你好，世界。',mergeSettings().basic.microsoft);
  assert.equal(result.text,'Hello, World.');assert.deepEqual(JSON.parse(request.opts.body),['你好，世界。']);
  assert.ok(request.url.includes('/translate/translatetext?from=zh-CHS&to=en'));assert.equal(request.opts.headers.Authorization,undefined);assert.equal(request.opts.credentials,'omit');assert.equal(request.opts.redirect,'error');
});
test('manual primary falls back in configured order; opt-out and missing consent prevent extra sends',async()=>{
  const calls=[];const providers=['microsoft','mymemory','libre'].map(id=>({id,name:id,available:async()=>true,translate:async()=>{calls.push(id);if(id==='mymemory')throw new ProviderError('length','too long');return {text:'Translated.'};}}));
  const s=mergeSettings({basicEngine:'mymemory',basic:{microsoft:{consent:true},mymemory:{consent:true},libre:{consent:true}}});
  const router=new BasicRouter(providers);assert.equal((await router.translate('中'.repeat(300),s,async()=>true)).providerId,'microsoft');assert.deepEqual(calls,['mymemory','microsoft']);assert.equal(router.health.mymemory,undefined);
  calls.length=0;s.basicFallback=false;await assert.rejects(new BasicRouter(providers).translate('x',s,async()=>true));assert.deepEqual(calls,['mymemory']);
  calls.length=0;s.basicEngine='auto';s.basic.microsoft.consent=false;s.basicOrder=['libre','microsoft','mymemory','azure','google'];assert.equal((await new BasicRouter(providers).translate('x',s,async()=>true)).providerId,'libre');assert.deepEqual(calls,['libre']);
});
test('Microsoft Azure uses user key and optional region, with a distinct official API contract',async()=>{
  let request;const p=createBasicProviders({fetcher:async(url,opts)=>{request={url,opts};return response([{translations:[{text:'Azure translation.',to:'en'}]}]);}}).find(p=>p.id==='azure');
  const config={...mergeSettings().basic.azure,key:'synthetic-key',region:'eastasia'};assert.equal(await p.available(config),true);assert.equal(await p.available({...config,key:''}),false);
  await p.translate('测试',config);assert.equal(request.opts.headers['Ocp-Apim-Subscription-Key'],'synthetic-key');assert.equal(request.opts.headers['Ocp-Apim-Subscription-Region'],'eastasia');assert.deepEqual(JSON.parse(request.opts.body),[{Text:'测试'}]);assert.ok(request.url.includes('api-version=3.0'));
});
test('basic normalization handles observed XLIFF tags and encoded entities as text',()=>{
  assert.equal(normalizeBasic('<g id="252">Hello </g>World.'),'Hello World.');
  assert.equal(normalizeBasic('Tom &amp; Jo&#39;s &#x4e2d;'),'Tom & Jo\'s 中');
  assert.equal(normalizeBasic('&lt;img src=x&gt;'),'<img src=x>');
});
test('fallback considers only explicitly consented, granted providers and displays source',async()=>{
  const calls=[];const providers=[{id:'mymemory',name:'MyMemory',available:async()=>true,translate:async()=>{calls.push('mymemory');throw new ProviderError('server','Down');}},{id:'libre',name:'Libre',available:async()=>true,translate:async()=>{calls.push('libre');return{text:'Hello.'};}}];
  const s=config();s.basic.libre.consent=false;
  await assert.rejects(new BasicRouter(providers).translate('你好',s,async()=>true),/Down/);assert.deepEqual(calls,['mymemory']);
  calls.length=0;s.basic.libre.consent=true;const result=await new BasicRouter(providers).translate('你好',s,async()=>true);assert.equal(result.engine,'Libre');assert.deepEqual(calls,['mymemory','libre']);
  calls.length=0;await assert.rejects(new BasicRouter(providers).translate('你好',s,async()=>false),/No available/);assert.deepEqual(calls,[]);
});
test('authentication blocks retries; rate limits and repeated failures cool down',async()=>{
  let calls=0,now=100;const provider={id:'mymemory',name:'MyMemory',available:async()=>true,translate:async()=>{calls++;throw new ProviderError('auth','Bad key');}};
  const router=new BasicRouter([provider],{now:()=>now});
  await assert.rejects(router.translate('x',config(),async()=>true));await assert.rejects(router.translate('x',config(),async()=>true));assert.equal(calls,1);
  const rate=new BasicRouter([{...provider,translate:async()=>{calls++;throw new ProviderError('rate','Slow down',5000);}}],{now:()=>now});
  await assert.rejects(rate.translate('x',config(),async()=>true));await assert.rejects(rate.translate('x',config(),async()=>true));assert.equal(calls,2);now+=5001;await assert.rejects(rate.translate('x',config(),async()=>true));assert.equal(calls,3);
});
test('MyMemory enforces UTF-8 byte length, normalizes quota and does not contribute translations',async()=>{
  const seen=[];const provider=createBasicProviders({fetcher:async(url,opts)=>{seen.push([url,opts]);return response({responseStatus:200,quotaFinished:'false',responseData:{translatedText:'Hello'}});}})[0];
  assert.equal((await provider.translate('你好',config().basic.mymemory)).text,'Hello');assert.ok(seen[0][0].includes('/get?'));assert.equal(seen[0][1].credentials,'omit');assert.equal(seen[0][1].redirect,'error');
  await assert.rejects(provider.translate('中'.repeat(167),config().basic.mymemory),/500/);assert.equal(seen.length,1);
  const quota=createBasicProviders({fetcher:async()=>response({responseStatus:200,quotaFinished:true,responseData:{translatedText:'warning'}})})[0];
  await assert.rejects(quota.translate('你好',config().basic.mymemory),e=>e.code==='quota');
});
test('LibreTranslate checks actual installed language pairs and posts plain text',async()=>{
  const requests=[];const provider=createBasicProviders({fetcher:async(url,opts)=>{requests.push({url,opts});return response(url.endsWith('/languages')?[{code:'zh',targets:['en']}]:{translatedText:'A PR.'});}})[1];
  assert.equal(await provider.available(config().basic.libre),true);await provider.translate('一个 PR',config().basic.libre);assert.equal(JSON.parse(requests[1].opts.body).format,'text');
});
test('network errors, 429 Retry-After, invalid JSON and timeouts become safe errors',async()=>{
  await assert.rejects(fetchJSON('https://test',{},50,async()=>response({},429,{'retry-after':'7'})),e=>e.code==='rate'&&e.retryAfter===7000);
  await assert.rejects(fetchJSON('https://test',{},50,async()=>new Response('not json')),e=>e.code==='response');
  await assert.rejects(fetchJSON('https://test',{},5,(_u,o)=>new Promise((_r,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('abort'))))),e=>e.code==='timeout');
});
test('OpenAI and compatible adapters use distinct token fields and never expose provider HTML',async()=>{
  let request;const fetcher=async(url,opts)=>{request={url,opts};return response({choices:[{message:{content:JSON.stringify({text:'This is a test.',vocabulary:[]})}}]});};
  const req={action:'polish',style:'natural',difficulty:'intermediate',maxWords:3,known:[]};
  const cfg={...mergeSettings().llm,endpoint:'https://api.test/v1',model:'model',key:'synthetic',provider:'openai'};
  await processLLM('This are a test.',cfg,req,fetcher);let body=JSON.parse(request.opts.body);assert.equal(body.max_completion_tokens,800);assert.equal(body.store,false);assert.equal(body.temperature,undefined);assert.equal(request.opts.headers.Authorization,'Bearer synthetic');
  await processLLM('This are a test.',{...cfg,provider:'compatible'},req,fetcher);body=JSON.parse(request.opts.body);assert.equal(body.max_tokens,800);assert.equal(body.max_completion_tokens,undefined);
});
test('Gemini adapter uses generateContent and handles fenced JSON; Explain keeps source',async()=>{
  const req={action:'explain',style:'natural',difficulty:'intermediate',maxWords:3,known:[]};let url;
  const cfg={...mergeSettings().llm,endpoint:'https://gemini.test/v1beta',model:'test-model',key:'synthetic',provider:'gemini'};
  const result=await processLLM('Keep this sentence.',cfg,req,async(u)=>{url=u;return response({candidates:[{content:{parts:[{text:'```json\n{"text":"Changed","explanation":"中文说明"}\n```'}]}}]});});
  assert.ok(url.endsWith('/models/test-model:generateContent'));assert.equal(result.text,'Keep this sentence.');assert.equal(result.explanation,'中文说明');assert.equal(result.changed,false);
  assert.throws(()=>parseLLM('<script>bad</script>','x',req,[]),/JSON/);
});

for(const provider of ['mimo','siliconflow'])test(`${provider} uses its official endpoint, authentication and token contract`,async()=>{
  const preset=LLM_PROVIDERS[provider],req={action:'translate',style:'natural',difficulty:'intermediate',maxWords:3,known:[]};
  let call;const fetcher=async(url,opts)=>{call={url,opts};return response({choices:[{message:{reasoning_content:'Ignored reasoning',content:'{"text":"Hello, world.","vocabulary":[]}'}}],usage:{total_tokens:42}});};
  const cfg={...mergeSettings().llm,provider,endpoint:preset.endpoint,model:preset.example,key:'synthetic-provider-key'};
  const result=await processLLM('你好，世界。',cfg,req,fetcher),body=JSON.parse(call.opts.body);
  assert.equal(call.url,preset.endpoint+'/chat/completions');assert.equal(body.model,preset.example);
  assert.equal(call.opts.credentials,'omit');assert.equal(call.opts.redirect,'error');assert.equal(body.temperature,undefined);
  assert.equal(result.text,'Hello, world.');assert.equal(result.engine,preset.name);assert.equal(result.usage,42);
  if(provider==='mimo'){
    assert.equal(call.opts.headers['api-key'],cfg.key);assert.equal(call.opts.headers.Authorization,undefined);
    assert.equal(body.max_completion_tokens,800);assert.equal(body.max_tokens,undefined);assert.deepEqual(body.thinking,{type:'disabled'});
  }else{
    assert.equal(call.opts.headers.Authorization,'Bearer '+cfg.key);assert.equal(call.opts.headers['api-key'],undefined);
    assert.equal(body.max_tokens,800);assert.equal(body.max_completion_tokens,undefined);assert.equal(body.thinking,undefined);
  }
  assert.equal(body.store,undefined);
  await assert.rejects(processLLM('你好',{...cfg,key:''},req,()=>{throw Error('Must not send');}),e=>e.code==='auth');
  await assert.rejects(processLLM('你好',cfg,req,async()=>response({error:{message:'private provider details'}},401)),e=>e.code==='auth'&&!e.message.includes('private'));
});
