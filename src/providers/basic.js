import { apiURL } from '../core/security.js';
import { ProviderError, fetchJSON, jsonPost } from './http.js';
import {createWebProviders} from './web-translation.js';

export function normalizeBasic(text) {
  if(typeof text!=='string')return text;
  // Translation memories may return XLIFF inline tags even for a plain segment.
  const plain=text.replace(/<\/?(?:g|x|bx|ex|ph|bpt|ept|it)\b[^>]*>/gi,'');
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return plain.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(match,key)=>{
    if(key[0]!=='#')return entities[key.toLowerCase()] ?? match;
    const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
    return code>0 && code<=0x10ffff && !(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):match;
  });
}

export function createBasicProviders({ fetcher = fetch } = {}) {
  return [
    {
      id:'mymemory', name:'MyMemory', category:'basic', pairs:[['zh','en'],['en','zh']],
      available: async config => Boolean(config.endpoint),
      async translate(text, config, pair={source:'zh',target:'en'}) {
        if (new TextEncoder().encode(text).length > 500) throw new ProviderError('length','MyMemory accepts at most 500 UTF-8 bytes. Shorten the input or choose another authorized engine.');
        const url = new URL(apiURL(config.endpoint, '/get'));
        const code=lang=>lang==='zh'?'zh-CN':'en';
        url.searchParams.set('q',text); url.searchParams.set('langpair',`${code(pair.source)}|${code(pair.target)}`);
        const body = await fetchJSON(url.toString(), {},12000,fetcher);
        if (body.quotaFinished===true || body.quotaFinished===1 || body.quotaFinished==='true' || Number(body.responseStatus) === 429 || /MYMEMORY WARNING|NEXT AVAILABLE IN/i.test(body.responseData?.translatedText || '')) throw new ProviderError('quota','MyMemory daily quota is exhausted.',86400000);
        if (Number(body.responseStatus) !== 200) throw new ProviderError('response','MyMemory could not translate this input.');
        return { text: normalizeBasic(body.responseData?.translatedText) };
      }
    },
    {
      id:'libre', name:'LibreTranslate', category:'basic', pairs:[['zh','en'],['en','zh']],
      async available(config,pair={source:'zh',target:'en'}) {
        if (!config.endpoint) return false;
        const languages = await fetchJSON(apiURL(config.endpoint,'/languages'),{},12000,fetcher);
        return Array.isArray(languages) && languages.some(x => x.code === pair.source && (!x.targets || x.targets.includes(pair.target)));
      },
      async translate(text, config,pair={source:'zh',target:'en'}) {
        const body = await fetchJSON(apiURL(config.endpoint,'/translate'),jsonPost({ q:text,source:pair.source,target:pair.target,format:'text',...(config.key ? {api_key:config.key} : {}) }),12000,fetcher);
        if (body.error) throw new ProviderError('response','LibreTranslate rejected the request. Check server settings.');
        return {text:normalizeBasic(body.translatedText)};
      }
    },
    {
      id:'google', name:'Google Cloud', category:'basic', pairs:[['zh','en'],['en','zh']],
      available: async config => Boolean(config.key),
      async translate(text, config,pair={source:'zh',target:'en'}) {
        const opts = jsonPost({ q:text,source:pair.source,target:pair.target,format:'text' });
        opts.headers['X-Goog-Api-Key'] = config.key;
        const body = await fetchJSON(apiURL(config.endpoint,'/language/translate/v2'),opts,12000,fetcher);
        return {text:normalizeBasic(body.data?.translations?.[0]?.translatedText)};
      }
    },
    {
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
    },
    {
      id:'azure', name:'Microsoft Azure', category:'basic', pairs:[['zh','en'],['en','zh']],
      available:async config=>Boolean(config.key),
      async translate(text,config,pair={source:'zh',target:'en'}){
        if(!config.key)throw new ProviderError('auth','Enter your Azure Translator key in Settings.');
        const url=new URL(apiURL(config.endpoint,'/translate'));
        const code=lang=>lang==='zh'?'zh-Hans':'en';url.searchParams.set('api-version','3.0');url.searchParams.set('from',code(pair.source));url.searchParams.set('to',code(pair.target));
        const opts=jsonPost([{Text:text}]);opts.headers['Ocp-Apim-Subscription-Key']=config.key;
        if(config.region)opts.headers['Ocp-Apim-Subscription-Region']=config.region;
        const data=await fetchJSON(url.toString(),opts,10000,fetcher);
        return {text:normalizeBasic(data?.[0]?.translations?.[0]?.text)};
      }
    },
    ...createWebProviders({fetcher})
  ];
}
