// Explicit live probe: only fixed synthetic text, never user drafts or personal keys.
import {createWebProviders} from '../src/providers/web-translation.js';
import {mergeSettings} from '../src/core/settings.js';
const settings=mergeSettings();
for(const provider of createWebProviders())for(const pair of [{source:'zh',target:'en'},{source:'en',target:'zh'}]){
  const start=Date.now();try{
    const result=await provider.translate(pair.source==='zh'?'你好，世界。':'Hello, world.',settings.basic[provider.id],pair);
    console.log(JSON.stringify({provider:provider.id,direction:`${pair.source}→${pair.target}`,ms:Date.now()-start,text:result.text}));
  }catch(error){console.log(JSON.stringify({provider:provider.id,direction:`${pair.source}→${pair.target}`,ms:Date.now()-start,code:error.code,message:error.message}));}
}
