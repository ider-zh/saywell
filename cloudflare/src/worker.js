import {systemPrompt,parseLLM} from '../../src/providers/llm.js';
import {HOSTED_AI_MODEL} from '../../src/core/hosted-ai.js';

class ServiceError extends Error{constructor(status,code,retry=0){super(code);this.status=status;this.code=code;this.retry=retry;}}
const MAX_BODY=32768;
const nextReset=()=>Math.ceil((Date.now()+1)/86400000)*86400000;
const resetSeconds=()=>Math.max(1,Math.ceil((nextReset()-Date.now())/1000));
let quotaUntil=0;
const plain=value=>Boolean(value && typeof value==='object' && !Array.isArray(value));
const extensionOrigin=origin=>/^chrome-extension:\/\/[a-p]{32}$/.test(origin || '');
function configuration(env){
  if(!['true','false'].includes(env.PREVIEW_ENABLED) || typeof env.ALLOWED_ORIGINS!=='string' || typeof env.PREVIEW_UNTIL!=='string')throw new ServiceError(503,'configuration_unavailable');
  if(env.PREVIEW_UNTIL && !Number.isFinite(Date.parse(env.PREVIEW_UNTIL)))throw new ServiceError(503,'configuration_unavailable');
  return {enabled:env.PREVIEW_ENABLED==='true' && (!env.PREVIEW_UNTIL || Date.now()<Date.parse(env.PREVIEW_UNTIL)),origins:env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean)};
}
function headers(request,config,id){
  const result={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Request-Id':id,'Vary':'Origin'};
  const origin=request.headers.get('Origin');if(origin && (config.origins.includes(origin) || extensionOrigin(origin)))result['Access-Control-Allow-Origin']=origin;
  return result;
}
async function readInput(request){
  if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')throw new ServiceError(415,'invalid_request');
  if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw new ServiceError(413,'input_too_large');
  const reader=request.body?.getReader();if(!reader)throw new ServiceError(400,'invalid_request');
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new ServiceError(413,'input_too_large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ServiceError(400,'invalid_request');}
  const enums={action:['translate','polish','explain'],style:['natural','concise','professional','casual'],targetLanguage:['en','zh'],difficulty:['beginner','intermediate','advanced']};
  if(!plain(value) || Object.keys(value).some(key=>!['text','thinking','maxWords','maxTokens',...Object.keys(enums)].includes(key)) || typeof value.text!=='string' || !value.text.trim() || value.text.length>6000 || typeof value.thinking!=='boolean' || !Number.isInteger(value.maxWords) || value.maxWords<0 || value.maxWords>3 || !Number.isInteger(value.maxTokens) || value.maxTokens<100 || value.maxTokens>800)throw new ServiceError(400,'invalid_request');
  for(const[key,allowed]of Object.entries(enums))if(!allowed.includes(value[key]))throw new ServiceError(400,'invalid_request');
  return value;
}
async function infer(env,input){
  if(!env.AI?.run || !env.CLIENT_LIMIT?.limit || !env.SERVICE_LIMIT?.limit)throw new ServiceError(503,'configuration_unavailable');
  if(quotaUntil>Date.now())throw new ServiceError(429,'daily_quota_exhausted',resetSeconds());
  let result;
  try{
    const instruction=input.action==='explain'?'Explain the source; keep the text field unchanged.':input.action==='translate'?`Translate the source into ${input.targetLanguage==='zh'?'Simplified Chinese':'English'}. The text field must contain the translation, not the source.`:`Polish the source in ${input.targetLanguage==='zh'?'Simplified Chinese':'English'} only if improvement is needed.`;
    result=await env.AI.run(HOSTED_AI_MODEL,{messages:[{role:'system',content:systemPrompt(input)+'\nCurrent task: '+instruction},{role:'user',content:JSON.stringify({action:input.action,targetLanguage:input.targetLanguage,text:input.text})}],max_completion_tokens:input.maxTokens,reasoning_effort:'low',chat_template_kwargs:{enable_thinking:input.thinking},response_format:{type:'json_object'},store:false,stream:false});
  }catch(error){
    // Inspect only for classification; never log/return raw provider errors or the draft.
    const code=Number(error?.code || error?.cause?.code),message=String(error?.message || '');
    if(code===3036 || /\b3036\b|daily free allocation|daily.*neurons/i.test(message)){quotaUntil=nextReset();throw new ServiceError(429,'daily_quota_exhausted',resetSeconds());}
    if(code===3040 || /\b3040\b|capacity|rate limit/i.test(message))throw new ServiceError(429,'temporarily_busy',60);
    throw new ServiceError(503,'inference_unavailable');
  }
  const raw=result?.choices?.[0]?.message?.content || result?.response;
  try{return {result:parseLLM(raw,input.text,input,[]),model:HOSTED_AI_MODEL,usage:{total_tokens:Math.max(0,Number(result?.usage?.total_tokens)||0)}};}
  catch{throw new ServiceError(502,'invalid_model_response');}
}
export default {
  async fetch(request,env){
    const id=crypto.randomUUID();let config={origins:[]};
    const respond=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers(request,config,id),...extra}});
    try{
      config=configuration(env);const url=new URL(request.url),origin=request.headers.get('Origin');
      // CORS is not authentication. This is a public, bounded, prerelease service.
      if(origin && !config.origins.includes(origin) && !extensionOrigin(origin))throw new ServiceError(403,'origin_not_allowed');
      if(url.search)throw new ServiceError(400,'invalid_request');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers(request,config,id),'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Saywell-Client','Access-Control-Max-Age':'600'}});
      if(request.method==='GET' && ['/health','/ready','/v1/status'].includes(url.pathname)){
        const ready=Boolean(env.AI?.run && env.CLIENT_LIMIT?.limit && env.SERVICE_LIMIT?.limit);
        return respond({service:'saywell-preview-ai',enabled:config.enabled,ready,model:HOSTED_AI_MODEL,quota:quotaUntil>Date.now()?'exhausted':'unknown',resetAt:new Date(nextReset()).toISOString()},url.pathname==='/ready' && !ready?503:200);
      }
      if(url.pathname!=='/v1/coach')throw new ServiceError(404,'not_found');
      if(request.method!=='POST')throw new ServiceError(405,'method_not_allowed');
      if(!config.enabled)throw new ServiceError(503,'preview_ended');
      if(request.headers.get('X-Saywell-Client')!=='1')throw new ServiceError(400,'invalid_request');
      if(!env.CLIENT_LIMIT?.limit || !env.SERVICE_LIMIT?.limit)throw new ServiceError(503,'configuration_unavailable');
      // IP based throttling is approximate and can affect users sharing a network; no login is required.
      const ip=request.headers.get('CF-Connecting-IP') || 'local';
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)),key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      if(!(await env.CLIENT_LIMIT.limit({key})).success || !(await env.SERVICE_LIMIT.limit({key:'preview'})).success)throw new ServiceError(429,'temporarily_busy',60);
      const input=await readInput(request);return respond(await infer(env,input));
    }catch(error){
      const failure=error instanceof ServiceError?error:new ServiceError(503,'service_unavailable');
      console.warn(JSON.stringify({event:'request_failed',requestId:id,code:failure.code}));
      return respond({error:{code:failure.code,requestId:id,...(failure.code==='daily_quota_exhausted'?{resetAt:new Date(nextReset()).toISOString()}: {})}},failure.status,failure.retry?{'Retry-After':String(failure.retry)}:{});
    }
  }
};
