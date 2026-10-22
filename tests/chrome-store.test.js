import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {zipSync} from 'fflate';
import {chromeStore} from '../scripts/chrome-store.mjs';
const itemId='abcdefghijklmnopabcdefghijklmnop',name=`publishers/synthetic-publisher/items/${itemId}`;
const zip=zipSync({'manifest.json':new TextEncoder().encode(JSON.stringify({manifest_version:3,version:'0.1.0'}))});
const config={publisherId:'synthetic-publisher',itemId,token:'synthetic-token-never-log',mode:'publish',repository:'ider-zh/saywell',ref:'refs/tags/v0.1.0',event:'push',version:'0.1.0',zip,sha256:createHash('sha256').update(zip).digest('hex')};
function fixture(replies){const calls=[];return {calls,fetcher:async(url,options)=>{calls.push({url,...options});const reply=replies.shift();if(!reply)throw new Error('Unexpected request');return new Response(JSON.stringify({name,itemId,...reply.body}),{status:reply.status || 200,headers:{'content-type':'application/json'}});},pause:async()=>{}};}
test('Chrome delivery checks the tested bytes and submits only a matching pushed tag without bypassing review',async()=>{
  const f=fixture([{body:{}},{body:{uploadState:'SUCCEEDED',crxVersion:'0.1.0'}},{body:{state:'PENDING_REVIEW'}}]);const result=await chromeStore(config,f);
  assert.equal(result.result,'submitted_for_review');assert.equal(f.calls.length,3);assert.equal(f.calls[1].body,zip);
  assert.ok(f.calls.every(call=>call.url.startsWith('https://chromewebstore.googleapis.com/') && call.redirect==='error'));
  assert.deepEqual(JSON.parse(f.calls[2].body),{publishType:'DEFAULT_PUBLISH',skipReview:false,blockOnWarnings:true});
  for(const change of [{ref:'refs/heads/main'},{event:'pull_request'},{repository:'another/repo'},{sha256:'0'.repeat(64)},{version:'0.1.1',ref:'refs/tags/v0.1.1'}]){
    const denied=fixture([]);await assert.rejects(chromeStore({...config,...change},denied));assert.equal(denied.calls.length,0);
  }
});
test('Chrome status is read-only, and existing published or pending versions are not uploaded again',async()=>{
  const status={publishedItemRevisionStatus:{state:'PUBLISHED',distributionChannels:[{crxVersion:'0.1.0'}]}};
  for(const change of [{mode:'status',ref:'refs/heads/main'},{}]){const f=fixture([{body:status}]);await chromeStore({...config,...change},f);assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'GET');}
  const pending={submittedItemRevisionStatus:{state:'PENDING_REVIEW',distributionChannels:[{crxVersion:'0.1.0'}]}};const f=fixture([{body:pending}]);assert.equal((await chromeStore(config,f)).result,'already_in_review');assert.equal(f.calls.length,1);
  pending.submittedItemRevisionStatus.distributionChannels[0].crxVersion='0.0.9';const other=fixture([{body:pending}]);await assert.rejects(chromeStore(config,other),/Another version/);assert.equal(other.calls.length,1);
});
test('Chrome async uploads are bounded and failed uploads never send a publish request',async()=>{
  const f=fixture([{body:{}},{body:{uploadState:'IN_PROGRESS'}},{body:{lastAsyncUploadState:'SUCCEEDED'}},{body:{state:'PENDING_REVIEW'}}]);await chromeStore(config,f);assert.equal(f.calls.length,4);
  for(const replies of [[{body:{}},{body:{uploadState:'FAILED'}}],[{body:{}},{body:{uploadState:'IN_PROGRESS'}},...Array.from({length:20},()=>({body:{lastAsyncUploadState:'IN_PROGRESS'}}))]]){
    const failed=fixture(replies);await assert.rejects(chromeStore(config,failed),/upload did not complete/);assert.ok(failed.calls.every(call=>!call.url.endsWith(':publish')));
  }
});
test('Chrome API errors, foreign item responses and policy warnings stop safely without echoing credentials or server text',async()=>{
  for(const replies of [[{status:403,body:{error:{message:config.token}}}],[{body:{name:'publishers/other/items/other'}}],[{body:{warned:true}}]]){
    const f=fixture(replies);await assert.rejects(chromeStore(config,f),error=>!error.message.includes(config.token));assert.equal(f.calls.length,1);
  }
});
