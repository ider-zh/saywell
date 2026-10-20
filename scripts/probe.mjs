import {fetchJSON} from '../src/providers/http.js';
const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q','你好，世界。');url.searchParams.set('langpair','zh-CN|en');
try{const r=await fetchJSON(url.toString());console.log(JSON.stringify({timestamp:new Date().toISOString(),engine:'MyMemory',status:r.responseStatus,text:r.responseData?.translatedText,quotaFinished:r.quotaFinished},null,2));}catch(e){console.log(JSON.stringify({timestamp:new Date().toISOString(),engine:'MyMemory',error:e.message},null,2));process.exitCode=1;}
