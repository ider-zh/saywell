import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../cloudflare/src/worker.js';
import {HOSTED_AI_MODEL} from '../src/core/hosted-ai.js';
const input=()=>({text:'你好，世界。',action:'translate',style:'natural',targetLanguage:'en',difficulty:'intermediate',maxWords:0,maxTokens:200,thinking:false});
const env=()=>({PREVIEW_ENABLED:'true',PREVIEW_UNTIL:'',ALLOWED_ORIGINS:'chrome-extension://test',AI:{run:async()=>({choices:[{message:{content:'{"text":"Hello, world.","vocabulary":[]}'}}],usage:{total_tokens:42}})},CLIENT_LIMIT:{limit:async()=>({success:true})},SERVICE_LIMIT:{limit:async()=>({success:true})}});
const req=(body=input(),headers={})=>new Request('https://worker.test/v1/coach',{method:'POST',headers:{'Content-Type':'application/json','X-Saywell-Client':'1',...headers},body:JSON.stringify(body)});

test('Worker health is inference-free, validates configuration, and rejects unlisted browser origins',async()=>{
  const e=env();e.AI.run=()=>{throw Error('Should not infer');};const response=await worker.fetch(new Request('https://worker.test/health'),e);assert.equal(response.status,200);assert.equal((await response.json()).model,HOSTED_AI_MODEL);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await worker.fetch(req(input(),{Origin:'https://evil.test'}),e)).status,403);
  const allowed=await worker.fetch(new Request('https://worker.test/health',{headers:{Origin:'chrome-extension://test'}}),e);assert.equal(allowed.headers.get('access-control-allow-origin'),'chrome-extension://test');
  const extension=await worker.fetch(new Request('https://worker.test/health',{headers:{Origin:'chrome-extension://'+'a'.repeat(32)}}),e);assert.equal(extension.headers.get('access-control-allow-origin'),'chrome-extension://'+'a'.repeat(32));
  assert.equal((await worker.fetch(new Request('https://worker.test/ready'),{...e,AI:null})).status,503);
  assert.equal((await worker.fetch(req(),{...e,PREVIEW_ENABLED:'invalid'})).status,503);
  assert.equal((await worker.fetch(req(),{...e,PREVIEW_ENABLED:'false'})).status,503);
  assert.equal((await worker.fetch(req(),{...e,PREVIEW_UNTIL:'2020-01-01T00:00:00Z'})).status,503);
});

test('Worker fixes model and system instructions, caps output, disables thinking and returns only validated suggestion text',async()=>{
  const e=env();let sent;e.AI.run=async(model,options)=>{sent={model,options};return {choices:[{message:{content:'{"text":"<img src=x>","vocabulary":[]}',reasoning_content:'private reasoning'}}],usage:{total_tokens:42}};};
  const response=await worker.fetch(req(),e),data=await response.json();assert.equal(response.status,200);assert.equal(sent.model,HOSTED_AI_MODEL);assert.equal(sent.options.max_completion_tokens,200);assert.deepEqual(sent.options.chat_template_kwargs,{enable_thinking:false});assert.equal(sent.options.store,false);assert.equal(sent.options.stream,false);assert.match(sent.options.messages[0].content,/Saywell/);assert.deepEqual(JSON.parse(sent.options.messages[1].content),{action:'translate',targetLanguage:'en',text:'你好，世界。'});
  assert.equal(data.result.text,'<img src=x>');assert.ok(!JSON.stringify(data).includes('private reasoning'));assert.equal(data.usage.total_tokens,42);
});

test('Worker rejects arbitrary prompts, malformed input, oversized bodies and output caps before inference',async()=>{
  const e=env();let calls=0;e.AI.run=async()=>{calls++;throw Error('not expected');};
  for(const body of [{...input(),messages:[]},{...input(),model:'paid-model'},{...input(),maxTokens:801},{...input(),text:'a'.repeat(6001)},{...input(),action:'execute'},{...input(),thinking:'false'},{...input(),maxWords:10}])assert.equal((await worker.fetch(req(body),e)).status,400);
  assert.equal((await worker.fetch(new Request('https://worker.test/v1/coach',{method:'POST',headers:{'Content-Type':'application/json','X-Saywell-Client':'1'},body:'x'.repeat(32769)}),e)).status,413);
  assert.equal((await worker.fetch(req(input(),{'X-Saywell-Client':'wrong'}),e)).status,400);assert.equal(calls,0);
});

test('Worker throttles before inference and sanitizes upstream failures without exposing drafts or provider details',async()=>{
  const e=env();e.CLIENT_LIMIT.limit=async()=>({success:false});let called=false;e.AI.run=async()=>{called=true;};const limited=await worker.fetch(req(),e);assert.equal(limited.status,429);assert.equal((await limited.json()).error.code,'temporarily_busy');assert.equal(called,false);
  for(const failure of [new Error('private draft and token'),Object.assign(new Error('capacity private'),{code:3040})]){
    const e=env();e.AI.run=async()=>{throw failure;};const response=await worker.fetch(req(),e),text=await response.text();assert.ok([429,503].includes(response.status));assert.ok(!text.includes('private'));assert.ok(!text.includes('你好'));
  }
  const invalid=env();invalid.AI.run=async()=>({choices:[{message:{content:'not json'}}]});assert.equal((await worker.fetch(req(),invalid)).status,502);
});

test('Worker maps Cloudflare 3036 to a daily quota alert and avoids another inference until UTC reset',async()=>{
  const e=env();let calls=0;e.AI.run=async()=>{calls++;throw Object.assign(new Error('3036 daily free allocation'),{code:3036});};
  const first=await worker.fetch(req(),e),data=await first.json();assert.equal(first.status,429);assert.equal(data.error.code,'daily_quota_exhausted');assert.equal(new Date(data.error.resetAt).getUTCHours(),0);assert.ok(Number(first.headers.get('retry-after'))>0);
  assert.equal((await worker.fetch(req(),e)).status,429);assert.equal(calls,1);
});
