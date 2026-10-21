// Explicit live model comparison: fixed synthetic fixtures only. Never prints login credentials or reasoning.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {ProxyAgent} from 'undici';
import {systemPrompt,parseLLM} from '../src/providers/llm.js';
import {modelInput} from '../cloudflare/src/model-input.js';
const account=process.argv[2],variant=process.argv[3] || 'template';if(!/^[a-f0-9]{32}$/.test(account || ''))throw new Error('Pass the Cloudflare account ID.');
if(!['template','soft','soft-text','soft-native','compare','validate'].includes(variant))throw new Error('Unknown synthetic probe variant.');
const config=await readFile(path.join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8'),token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];if(!token)throw new Error('Run npx wrangler login first.');
const proxy=process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy,dispatcher=proxy?new ProxyAgent(proxy):undefined;
const candidate='@cf/qwen/qwen3-30b-a3b-fp8',previous='@cf/qwen/qwen3.8-27b',fixtures=[
  {action:'translate',text:'你好，世界。',targetLanguage:'en',maxWords:0,maxTokens:400},
  {action:'polish',text:'This are a test.',targetLanguage:'en',maxWords:0,maxTokens:400},
  {action:'translate',text:'Hello, world.',targetLanguage:'zh',maxWords:0,maxTokens:400},
  {action:'translate',text:'请在 Friday 之前用 Saywell 完成 v2.1 的 3 项测试，不要修改 API 名称。',targetLanguage:'en',maxWords:3,maxTokens:800},
  {action:'explain',text:'Could we streamline this process?',targetLanguage:'en',maxWords:3,maxTokens:800},
  {action:'polish',text:'Thanks for your help.',targetLanguage:'en',maxWords:0,maxTokens:400}
];
const rows=[];
for(const model of variant==='compare'?[previous,candidate]:[candidate])for(const fixture of ['compare','validate'].includes(variant)?fixtures:fixtures.slice(0,1)){
  const input={style:'natural',difficulty:'intermediate',thinking:false,...fixture},instruction=input.action==='explain'?'Explain the source; keep the text field unchanged.':input.action==='translate'?`Translate the source into ${input.targetLanguage==='zh'?'Simplified Chinese':'English'}. The text field must contain the translation, not the source.`:`Polish the source in ${input.targetLanguage==='zh'?'Simplified Chinese':'English'} only if improvement is needed.`;
  const messages=[{role:'system',content:systemPrompt(input)+'\nCurrent task: '+instruction},{role:'user',content:JSON.stringify({action:input.action,targetLanguage:input.targetLanguage,text:input.text})+(model===candidate && variant!=='template'?'\n/no_think':'')}];
  const options=['compare','validate'].includes(variant)?modelInput(input,model):{messages,...(['soft-text','soft-native'].includes(variant)?{}:{response_format:{type:'json_object'}}),...(variant==='soft-native'?{}:{chat_template_kwargs:{enable_thinking:false}}),stream:false,max_tokens:input.maxTokens},start=Date.now();
  try{
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(options),...(dispatcher?{dispatcher}:{}),signal:AbortSignal.timeout(60000)}),body=await response.json(),result=body.result,message=result?.choices?.[0]?.message,raw=message?.content || result?.response;
    let parsed,valid=false;try{parsed=parseLLM(raw,input.text,input,[]);valid=true;if(variant==='validate'){
      if((input.action==='explain' || input.action==='polish' && parsed.text!==input.text) && !/\p{Script=Han}/u.test(parsed.explanation))valid=false;
      if(input.text==='This are a test.' && parsed.text!=='This is a test.')valid=false;
      if(input.text==='Thanks for your help.' && parsed.text!==input.text)valid=false;
      if(input.maxWords===3 && input.action==='translate' && (!parsed.vocabulary.length || !['Saywell','v2.1','3','Friday','API'].every(term=>parsed.text.includes(term))))valid=false;
    }}catch{}
    const row={model,variant,action:input.action,targetLanguage:input.targetLanguage,maxWords:input.maxWords,ms:Date.now()-start,status:response.status,success:body.success,codes:body.errors?.map(error=>error.code),valid,hasReasoning:Boolean(message?.reasoning_content?.trim() || /<think>\s*\S/i.test(raw || '')),finish:result?.choices?.[0]?.finish_reason,usage:result?.usage,...(valid?{text:parsed.text,vocabulary:parsed.vocabulary.length,explanation:parsed.explanation}: {contentPrefix:String(raw || '').slice(0,120)})};rows.push(row);console.log(JSON.stringify(row));
    if(!response.ok || !valid || row.hasReasoning){process.exitCode=1;break;}
  }catch{rows.push({model,action:input.action,error:'Probe failed or timed out.'});console.log(JSON.stringify(rows.at(-1)));process.exitCode=1;break;}
}
await mkdir('test-results',{recursive:true});await writeFile('test-results/cloudflare-candidate-'+variant+'.json',JSON.stringify(rows,null,2));
