// Only fixed synthetic text. No provider key, personal text, or provider token is printed.
import {fetchJSON,jsonPost} from '../src/providers/http.js';
const phrase='你好，世界。';
const providers=[
  ['Microsoft Edge (experimental)','https://edge.microsoft.com/translate/translatetext?from=zh-CHS&to=en',jsonPost([phrase])],
  ['MyMemory','https://api.mymemory.translated.net/get?q='+encodeURIComponent(phrase)+'&langpair=zh-CN%7Cen',{}],
  ...['https://translate.cutie.dating','https://translate.terraprint.co','https://translate.argosopentech.com','https://translate.flossbox.in','https://libretranslate.de'].map(endpoint=>[endpoint,endpoint+'/languages',{}])
];
await Promise.all(providers.filter(([id])=>!process.argv.includes('--microsoft') || id.startsWith('Microsoft')).map(async([id,url,options])=>{
  const start=Date.now();try{const data=await fetchJSON(url,options,8000);console.log(JSON.stringify({id,ms:Date.now()-start,status:data.responseStatus,languages:Array.isArray(data)&&data[0]?.code?data.map(x=>x.code):undefined,text:data.responseData?.translatedText || data[0]?.translations?.[0]?.text,quota:data.quotaFinished}));
    if(Array.isArray(data) && data.some(l=>l.code==='zh'&&(!l.targets||l.targets.includes('en')))){
      const result=await fetchJSON(id+'/translate',jsonPost({q:phrase,source:'zh',target:'en',format:'text'}),12000);console.log(JSON.stringify({id,phase:'translate',text:result.translatedText,error:result.error}));
    }
  }catch(e){console.log(JSON.stringify({id,ms:Date.now()-start,code:e.code,error:e.message}));}
}));
