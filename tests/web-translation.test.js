import test from 'node:test';import assert from 'node:assert/strict';
import {createWebProviders} from '../src/providers/web-translation.js';
import {BasicRouter} from '../src/providers/router.js';
import {mergeSettings,validateSettings} from '../src/core/settings.js';
import {exportConfigBackup,parseConfigBackup} from '../src/core/config-backup.js';
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const html='var params_AbusePreventionHelper = [123456,"synthetic-page-token",600000]; IG:"ABC123", <div data-iid="translator.42" id="rich_tta">';

test('Google web uses the keyless legacy protocol, joins all segments, supports both directions and rejects invalid or oversized output',async()=>{
  const calls=[],p=createWebProviders({fetcher:async(url,opts)=>{calls.push({url,opts});return json([[['Hello. ','one'],['Next.','two']]]);}})[0],cfg=mergeSettings().basic.googleweb;
  assert.equal((await p.translate('中文 &=#',cfg)).text,'Hello. Next.');let u=new URL(calls[0].url);
  assert.equal(u.pathname,'/translate_a/single');assert.equal(u.searchParams.get('client'),'gtx');assert.equal(u.searchParams.get('dt'),'t');assert.equal(u.searchParams.get('q'),'中文 &=#');assert.equal(u.searchParams.get('sl'),'zh-CN');assert.equal(u.searchParams.get('tl'),'en');
  await p.translate('Hello.',cfg,{source:'en',target:'zh'});u=new URL(calls[1].url);assert.equal(u.searchParams.get('sl'),'en');assert.equal(u.searchParams.get('tl'),'zh-CN');
  assert.equal(calls[0].opts.credentials,'omit');assert.equal(calls[0].opts.redirect,'error');assert.equal(calls[0].opts.headers?.Authorization,undefined);
  await assert.rejects(p.translate('中'.repeat(5001),cfg),e=>e.code==='length');assert.equal(calls.length,2);
  for(const body of [{},[],[[]],[[[null]]],[[['']]]])await assert.rejects(createWebProviders({fetcher:async()=>json(body)})[0].translate('中',cfg),e=>e.code==='response');
  await assert.rejects(createWebProviders({fetcher:async()=>json({},403)})[0].translate('中',cfg),e=>e.code==='unavailable'&&!e.message.includes('key'));
});

test('Bing bootstraps anonymous parameters once, coalesces concurrent loads, caches by endpoint, expires and posts both directions without cookies',async()=>{
  let now=100;const calls=[],p=createWebProviders({now:()=>now,fetcher:async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/translator')){await new Promise(resolve=>setTimeout(resolve,5));return new Response(html);}const target=new URLSearchParams(opts.body).get('to');return json([{translations:[{text:target==='en'?'Hello.':'你好。',to:target}]}]);}})[1],cfg=mergeSettings().basic.bing;
  await Promise.all([p.translate('你好。',cfg),p.translate('Hello.',cfg,{source:'en',target:'zh'})]);assert.equal(calls.filter(c=>c.url.endsWith('/translator')).length,1);
  const posts=calls.filter(c=>c.opts.method==='POST');assert.equal(posts.length,2);assert.notEqual(new URL(posts[0].url).searchParams.get('IID'),new URL(posts[1].url).searchParams.get('IID'));
  assert.equal(new URLSearchParams(posts[0].opts.body).get('fromLang'),'zh-Hans');assert.equal(new URLSearchParams(posts[1].opts.body).get('to'),'zh-Hans');
  for(const call of calls){assert.equal(call.opts.credentials,'omit');assert.equal(call.opts.redirect,'error');assert.equal(call.opts.headers?.Cookie,undefined);}
  assert.equal(new URLSearchParams(posts[0].opts.body).get('token'),'synthetic-page-token');assert.equal(new URL(posts[0].url).searchParams.get('IG'),'ABC123');
  await p.translate('再测试。',cfg);assert.equal(calls.filter(c=>c.url.endsWith('/translator')).length,1);
  now+=600001;await p.translate('过期。',cfg);await p.translate('另一端点。',{endpoint:'https://other.test'});assert.equal(calls.filter(c=>c.url.endsWith('/translator')).length,3);
});

test('Bing refuses malformed or challenge pages without executing scripts, rejects long drafts before I/O, and safely invalidates failed sessions',async()=>{
  const cfg=mergeSettings().basic.bing;
  for(const page of ['verification required','var params_AbusePreventionHelper = [1,window.__executed=true,1000];',html.replace('"synthetic-page-token"','"<script>secret</script>"'),'x'.repeat(1024*1024+1)]){
    const calls=[],p=createWebProviders({fetcher:async(url)=>{calls.push(url);return new Response(page);}})[1];
    await assert.rejects(p.translate('中',cfg),e=>['unavailable','response'].includes(e.code)&&!e.message.includes('secret'));assert.equal(calls.length,1);assert.equal(globalThis.__executed,undefined);
  }
  let calls=0;const long=createWebProviders({fetcher:async()=>{calls++;return new Response(html);}})[1];await assert.rejects(long.translate('中'.repeat(1001),cfg),e=>e.code==='length');assert.equal(calls,0);
  for(const [body,status,code]of [[{statusCode:'429',errorMessage:'private token'},200,'rate'],[{statusCode:400,errorMessage:'private token'},200,'unavailable'],[{},403,'unavailable'],[{errorMessage:'private token'},429,'rate'],[[{}],200,'response'],[[{translations:{}}],200,'response'],[[{translations:[null]}],200,'response']]){
    const requests=[],p=createWebProviders({fetcher:async(url)=>{requests.push(url);return url.endsWith('/translator')?new Response(html):json(body,status);}})[1];
    await assert.rejects(p.translate('中',cfg),e=>e.code===code&&!e.message.includes('private token'));assert.equal(requests.length,2);
    await assert.rejects(p.translate('中',cfg));assert.equal(requests.filter(u=>u.endsWith('/translator')).length,2);
  }
});

test('Bing checks access again after page loading and never posts a draft after consent or permission changes',async()=>{
  let allowed=true;const calls=[],p=createWebProviders({fetcher:async(url)=>{calls.push(url);allowed=false;return new Response(html);}})[1];
  await assert.rejects(p.translate('不应发出。',mergeSettings().basic.bing,undefined,async()=>allowed),e=>e.code==='permission');assert.equal(calls.length,1);assert.ok(calls[0].endsWith('/translator'));
});

test('web fallback is ordered, consented and granted; rate-limit diagnostics omit drafts and temporary Bing parameters',async()=>{
  const calls=[],web=createWebProviders({fetcher:async(url)=>{calls.push(url);return url.endsWith('/translator')?new Response('verification required'):json({},429,{'retry-after':'4'});}});
  const s=mergeSettings({basic:{googleweb:{consent:true},bing:{consent:true},mymemory:{consent:true}}}),providers=[...web,{id:'mymemory',name:'MyMemory',available:async()=>true,translate:async()=>({text:'Fallback.'})}];
  const router=new BasicRouter(providers),result=await router.translate('不保存的测试文本。',s,async()=>true);assert.equal(result.providerId,'mymemory');assert.deepEqual(result.attempts.map(a=>a.status),['rate','unavailable','success']);assert.ok(router.health.googleweb.until>Date.now());
  assert.ok(!JSON.stringify({attempts:result.attempts,health:router.health}).includes('不保存'));calls.length=0;s.basic.googleweb.consent=false;s.basic.bing.consent=false;await new BasicRouter(providers).translate('中',s,async()=>true);assert.equal(calls.length,0);
  s.basic.googleweb.consent=true;await new BasicRouter(providers).translate('中',s,async endpoint=>!endpoint.includes('googleapis'));assert.equal(calls.length,0);
});

test('existing fallback priorities and version-one backups migrate without enabling new web providers',()=>{
  const order=['libre','mymemory','microsoft','google','azure'],old=mergeSettings({basicOrder:order,basic:{mymemory:{consent:true}}});
  assert.deepEqual(old.basicOrder,[...order,'googleweb','bing']);assert.equal(old.basic.googleweb.consent,false);assert.equal(old.basic.bing.consent,false);validateSettings(old);
  const backup=exportConfigBackup(old);delete backup.settings.basic.googleweb;delete backup.settings.basic.bing;backup.settings.basicOrder=order;
  const parsed=parseConfigBackup(JSON.stringify(backup));assert.deepEqual(parsed.settings.basicOrder,[...order,'googleweb','bing']);assert.equal(parsed.settings.basic.bing.consent,false);
  assert.throws(()=>validateSettings(mergeSettings({basicOrder:['microsoft','microsoft','mymemory','libre','azure']})));
});
