// Read-only account checks using the local Wrangler OAuth login. Never prints credentials.
import {readFile} from 'node:fs/promises';import path from 'node:path';import {ProxyAgent} from 'undici';
const account=process.argv[2];if(!/^[a-f0-9]{32}$/.test(account || ''))throw new Error('Pass the Cloudflare account ID.');
const config=await readFile(path.join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8');
const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];if(!token)throw new Error('Run npx wrangler login first.');
const proxy=process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
for(const route of ['subscriptions','workers/subdomain','workers/scripts']){
  try{
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${route}`,{headers:{Authorization:`Bearer ${token}`},...(proxy?{dispatcher:new ProxyAgent(proxy)}:{}),signal:AbortSignal.timeout(15000)}),body=await response.json();
    const result=route==='subscriptions'?body.result?.map(s=>({state:s.state,plan:s.rate_plan?.id,name:s.rate_plan?.public_name})):route==='workers/scripts'?body.result?.map(s=>s.id):body.result;
    console.log(JSON.stringify({route,status:response.status,success:body.success,result,codes:body.errors?.map(e=>e.code)}));
  }catch{console.log(JSON.stringify({route,error:'Account check failed.'}));}
}
