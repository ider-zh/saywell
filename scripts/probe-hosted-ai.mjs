// Explicit live smoke test with fixed synthetic text only; never tests a user's draft or keys.
import {ProxyAgent} from 'undici';import {processLLM} from '../src/providers/llm.js';import {mergeSettings} from '../src/core/settings.js';import {HOSTED_AI_ENDPOINT} from '../src/core/hosted-ai.js';
const proxy=process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy,dispatcher=proxy?new ProxyAgent(proxy):undefined;
const fetcher=(url,options={})=>fetch(url,{...options,...(dispatcher?{dispatcher}: {})});
for(const path of ['/health','/ready']){const response=await fetcher(new URL(path,HOSTED_AI_ENDPOINT),{signal:AbortSignal.timeout(15000)});console.log(JSON.stringify({path,status:response.status,body:await response.json()}));}
for(const[action,text,targetLanguage]of [['translate','你好，世界。','en'],['polish','This are a test.','en'],['translate','Hello, world.','zh']]){
  const start=Date.now();try{const result=await processLLM(text,{...mergeSettings().llm,maxTokens:400,timeout:40000},{action,targetLanguage,style:'natural',difficulty:'intermediate',maxWords:0,known:[]},fetcher);console.log(JSON.stringify({action,targetLanguage,ms:Date.now()-start,text:result.text,usage:result.usage}));}
  catch(error){console.log(JSON.stringify({action,code:error.code,message:error.message}));process.exitCode=1;}
}
