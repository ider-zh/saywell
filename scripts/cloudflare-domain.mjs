// Inspect only routing/DNS metadata through the operator's local Wrangler OAuth.
// Credentials are used in memory and are never printed or placed in the project.
import {readFile} from 'node:fs/promises';import path from 'node:path';import {ProxyAgent} from 'undici';
const account='aaf26fe4d20ebdb6d6a93f6ba73961fd',zoneName='9992099.xyz';
const config=await readFile(path.join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8');
const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];if(!token)throw new Error('Run npx wrangler login first.');
const proxy=process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const dispatcher=proxy?new ProxyAgent(proxy):undefined;
async function get(route,options={}){
  const response=await fetch('https://api.cloudflare.com/client/v4'+route,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(dispatcher?{dispatcher}:{}),signal:AbortSignal.timeout(20000)});
  const body=await response.json();return {status:response.status,success:body.success,result:body.result,codes:body.errors?.map(e=>e.code)};
}
const zones=await get('/zones?name='+zoneName);console.log(JSON.stringify({kind:'zone',...zones,result:zones.result?.map(z=>({id:z.id,name:z.name,status:z.status,account:z.account?.id}))}));
const zone=zones.result?.find(z=>z.name===zoneName && z.account?.id===account);
if(process.argv.includes('--plan')){
  if(!zone || zone.status!=='active')throw new Error('Expected active zone was not found.');
  const changes=await get(`/accounts/${account}/workers/scripts/saywell-preview-ai/domains/changeset?replace_state=true`,{method:'POST',body:JSON.stringify([{hostname:'saywell.'+zoneName,zone_id:zone.id}])});
  console.log(JSON.stringify({kind:'routing-plan',...changes}));process.exit(changes.success?0:1);
}
if(zone){for(const host of [zoneName,'api.'+zoneName,'saywell.'+zoneName]){const records=await get(`/zones/${zone.id}/dns_records?name=${host}`);console.log(JSON.stringify({kind:'dns',host,...records,result:records.result?.map(r=>({id:r.id,name:r.name,type:r.type,content:r.content,proxied:r.proxied}))}));}}
const domains=await get(`/accounts/${account}/workers/domains/records`);console.log(JSON.stringify({kind:'workers-domains',...domains}));
