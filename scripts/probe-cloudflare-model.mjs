// Explicit synthetic inference probe. Reads the Wrangler login without printing credentials.
import {readFile} from 'node:fs/promises';import path from 'node:path';import {ProxyAgent} from 'undici';
import {HOSTED_AI_MODEL} from '../src/core/hosted-ai.js';import {modelInput} from '../cloudflare/src/model-input.js';
const account=process.argv[2];if(!/^[a-f0-9]{32}$/.test(account || ''))throw new Error('Pass the Cloudflare account ID.');
const config=await readFile(path.join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8'),token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];
if(!token)throw new Error('Run npx wrangler login first.');
const proxy=process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${HOSTED_AI_MODEL}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(modelInput({action:'translate',text:'你好，世界。',targetLanguage:'en',style:'natural',difficulty:'intermediate',maxWords:0,maxTokens:200,thinking:false},HOSTED_AI_MODEL)),...(proxy?{dispatcher:new ProxyAgent(proxy)}:{}),signal:AbortSignal.timeout(60000)});
const body=await response.json(),result=body.result;console.log(JSON.stringify({status:response.status,success:body.success,codes:body.errors?.map(e=>e.code),content:result?.choices?.[0]?.message?.content || result?.response,hasReasoning:Boolean(result?.choices?.[0]?.message?.reasoning_content),usage:result?.usage}));
