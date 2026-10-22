import {apiURL} from '../core/security.js';
import {normalizeBasic} from './basic.js';
import {fetchJSON,fetchText,jsonPost,ProviderError} from './http.js';

const pairs=[['zh','en'],['en','zh']];
const code=lang=>lang==='zh'?'zh-Hans':'en';
async function checkAccess(canSend){if(!await canSend())throw new ProviderError('permission','Service was disabled or its access changed. Connect it again in Settings.');}
function webError(error,name){return error.code==='auth'?new ProviderError('unavailable',`${name} is unavailable. Try another enabled engine.`):error;}
function translation(data,target,name){
  const entries=data?.[0]?.translations,text=Array.isArray(entries)?entries.find(item=>item?.to===target)?.text:undefined;
  if(typeof text!=='string' || !text.trim())throw new ProviderError('response',`${name} returned no usable translation.`);
  return {text};
}
function bingSession(html){
  try{
    const raw=/\bparams_AbusePreventionHelper\s*=\s*(\[[^;\r\n]{1,4096}\])\s*;/.exec(html)?.[1];
    const [key,token,ttl]=JSON.parse(raw);
    const ig=/\bIG\s*:\s*"([a-zA-Z0-9]{1,128})"/.exec(html)?.[1];
    const tag=/<[^>]{0,1000}\bid=["']rich_tta["'][^>]{0,1000}>/.exec(html)?.[0];
    const iid=/\bdata-iid=["']([\w.-]{1,100})["']/.exec(tag || '')?.[1];
    if(!Number.isSafeInteger(key) || key<=0 || typeof token!=='string' || !/^[a-zA-Z0-9+/_=-]{1,2048}$/.test(token) || !ig || !iid)throw 0;
    return {key:String(key),token,ig,iid,count:0,ttl:Number.isFinite(ttl)&&ttl>0?Math.min(ttl,600000):600000};
  }catch{throw new ProviderError('unavailable','Bing web translation is unavailable. Try another enabled engine.');}
}

// Protocol adapters are independently implemented. No page scripts are executed.
export function createWebProviders({fetcher=fetch,now=Date.now}={}){
  // Anonymous page parameters stay in worker memory, never in settings, exports or diagnostics.
  const sessions=new Map(),pending=new Map();
  async function session(endpoint){
    const page=apiURL(endpoint,'/translator'),cached=sessions.get(page);
    if(cached && cached.expires>now())return cached;
    if(!pending.has(page)){
      const request=(async()=>{
        const html=await fetchText(page,{},8000,fetcher,1024*1024).catch(error=>{throw webError(error,'Bing web translation');}),value=bingSession(html);
        value.expires=now()+value.ttl;
        if(sessions.size>=4)sessions.delete(sessions.keys().next().value);
        sessions.set(page,value);return value;
      })();pending.set(page,request);
    }
    try{return await pending.get(page);}finally{pending.delete(page);}
  }
  return [
    {id:'googleweb',name:'Google Translate (web, experimental)',category:'basic',pairs,
      available:async config=>Boolean(config.endpoint),
      async translate(text,config,pair={source:'zh',target:'en'},canSend=async()=>true){
        if(text.length>5000)throw new ProviderError('length','Google web translation accepts at most 5,000 characters. Shorten the input or use another enabled engine.');
        const url=new URL(apiURL(config.endpoint,'/translate_a/single'));
        for(const[key,value]of Object.entries({client:'gtx',dt:'t',sl:pair.source==='zh'?'zh-CN':'en',tl:pair.target==='zh'?'zh-CN':'en',q:text}))url.searchParams.set(key,value);
        await checkAccess(canSend);const data=await fetchJSON(url.toString(),{},8000,fetcher).catch(error=>{throw webError(error,'Google web translation');});
        if(!Array.isArray(data?.[0]) || !data[0].length || data[0].some(part=>!Array.isArray(part) || typeof part[0]!=='string'))throw new ProviderError('response','Google web translation returned no usable translation.');
        const result=data[0].map(part=>part[0]).join('');
        if(!result.trim())throw new ProviderError('response','Google web translation returned no usable translation.');
        return {text:result};
      }
    },
    {id:'bing',name:'Microsoft Bing (web, experimental)',category:'basic',pairs,
      available:async config=>Boolean(config.endpoint),
      async translate(text,config,pair={source:'zh',target:'en'},canSend=async()=>true){
        if(text.length>1000)throw new ProviderError('length','Bing web translation accepts at most 1,000 characters. Shorten the input or use another enabled engine.');
        await checkAccess(canSend);const value=await session(config.endpoint),url=new URL(apiURL(config.endpoint,'/ttranslatev3'));
        url.searchParams.set('isVertical','1');url.searchParams.set('IG',value.ig);url.searchParams.set('IID',`${value.iid}.${++value.count}`);
        const body=new URLSearchParams({fromLang:code(pair.source),to:code(pair.target),text,key:value.key,token:value.token});
        try{
          await checkAccess(canSend);
          const data=await fetchJSON(url.toString(),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},8000,fetcher);
          if(Number(data?.statusCode)===429)throw new ProviderError('rate','Bing web translation is rate limited. Try later.',60000);
          if(!Array.isArray(data))throw new ProviderError('unavailable','Bing web translation is unavailable. Try another enabled engine.');
          return translation(data,code(pair.target),'Bing web translation');
        }catch(error){sessions.delete(apiURL(config.endpoint,'/translator'));throw webError(error,'Bing web translation');}
      }
    }
  ];
}

// Historical protocol fixture only; not imported by the store worker.
export function createLegacyEdgeProvider(fetcher=fetch){return {
      id:'microsoft', name:'Microsoft Edge (experimental)', category:'basic', pairs:[['zh','en'],['en','zh']],
      available:async config=>Boolean(config.endpoint),
      async translate(text,config,pair={source:'zh',target:'en'}){
        const url=new URL(apiURL(config.endpoint,'/translate/translatetext'));
        const code=lang=>lang==='zh'?'zh-CHS':'en';url.searchParams.set('from',code(pair.source));url.searchParams.set('to',code(pair.target));
        const data=await fetchJSON(url.toString(),jsonPost([text]),8000,fetcher);
        const result=data?.[0]?.translations?.find(t=>t.to===code(pair.target)) || data?.[0]?.translations?.[0];
        if(typeof result?.text!=='string' || !result.text.trim())throw new ProviderError('response','Microsoft Edge returned no usable translation.');
        return {text:normalizeBasic(result.text)};
      }
    };}
