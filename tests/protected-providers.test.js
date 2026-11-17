import test from 'node:test';import assert from 'node:assert/strict';
import {processLLM} from '../src/providers/llm.js';
import {createBasicProviders} from '../src/providers/basic.js';
import {mergeSettings} from '../src/core/settings.js';
const source='请检查 C:\\demo\\report.txt，并发给 dev@example.com，参考 https://example.com/help。';
const request={action:'translate',targetLanguage:'en',style:'natural',difficulty:'intermediate',maxWords:3,known:[]};
const config={...mergeSettings().llm,provider:'ollama',endpoint:'http://localhost:1234/v1',model:'synthetic'};
const reply=value=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}));

test('LLM receives typed placeholders and returns exact original values without teaching them as vocabulary',async()=>{
  let sent;
  const result=await processLLM(source,config,request,async(_url,options)=>{
    sent=JSON.parse(options.body);const text=JSON.parse(sent.messages[1].content).text;
    assert.ok(!text.includes('dev@example.com'));assert.ok(!text.includes('https://example.com'));assert.ok(!text.includes('C:\\demo'));
    const tokens=text.match(/__SWP_[a-f0-9]+_[A-Z]+_\d+__/g);assert.equal(tokens.length,3);
    return reply({text:`Check ${tokens[0]} and email ${tokens[1]}; see ${tokens[2]}.`,explanation:`请参考 ${tokens[2]}`,vocabulary:[{word:'example',meaning:'示例'},{word:'Check',meaning:'检查'}]});
  });
  assert.equal(result.text,'Check C:\\demo\\report.txt and email dev@example.com; see https://example.com/help.');
  assert.equal(result.explanation,'请参考 https://example.com/help');assert.deepEqual(result.vocabulary.map(v=>v.word),['Check']);
});

test('a missing or translated placeholder rejects the LLM result with no raw-text retry',async()=>{
  let calls=0;await assert.rejects(processLLM(source,config,request,async()=>{calls++;return reply({text:'Check the report and send an email.',vocabulary:[]});}),error=>error.code==='response');assert.equal(calls,1);
});

test('MT retains raw inputs: a mock translator can translate bracket labels, so MT must not rely on them',async()=>{
  const raw='请查看 https://example.com 和 [FILE_PATH_1]。';let sent;
  const provider=createBasicProviders({fetcher:async(url)=>{sent=new URL(url).searchParams.get('q');return new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:'See https://example.com and [文件路径_1].'}}));}}).find(p=>p.id==='mymemory');
  const result=await provider.translate(raw,mergeSettings().basic.mymemory);
  assert.equal(sent,raw);assert.equal(result.text,'See https://example.com and [文件路径_1].');
});

for(const provider of ['openai','compatible','ollama','deepseek','mimo','siliconflow','gemini','saywell'])test(`${provider} protects source values with the existing request contract`,async()=>{
  let payload;
  const result=await processLLM(source,{...config,provider,key:'synthetic-test-key'},request,async(_url,options)=>{
    payload=JSON.parse(options.body);const masked=provider==='saywell'?payload.text:provider==='gemini'?payload.contents[0].parts[0].text:JSON.parse(payload.messages[1].content).text;
    assert.ok(!JSON.stringify(payload).includes('dev@example.com'));const value={text:'Edited: '+masked,explanation:'',vocabulary:[]};
    return provider==='saywell'?new Response(JSON.stringify({result:value})):provider==='gemini'?new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]})):reply(value);
  });
  assert.equal(result.text,'Edited: '+source);assert.ok(!JSON.stringify(result).includes('__SWP_'));
  if(provider==='saywell'){assert.equal(payload.messages,undefined);assert.equal(payload.model,undefined);}
});

test('Explain and manual address-only responses restore fully; corrupt optional fields are discarded',async()=>{
  const only='https://example.com/a';
  const explained=await processLLM(only,config,{...request,action:'explain'},async(_url,options)=>{const text=JSON.parse(JSON.parse(options.body).messages[1].content).text;return reply({text,explanation:'见 '+text,vocabulary:[]});});
  assert.equal(explained.text,only);assert.equal(explained.changed,false);assert.equal(explained.explanation,'见 '+only);
  const result=await processLLM('Check '+only,config,request,async(_url,options)=>{const masked=JSON.parse(JSON.parse(options.body).messages[1].content).text;return reply({text:'Please '+masked,alternative:'An alternative that lost the link.',explanation:'__SWP_0000000000000000_URL_99__',vocabulary:[{word:'Check',meaning:'检查',example:masked}]});});
  assert.equal(result.alternative,'');assert.equal(result.explanation,'');assert.equal(result.vocabulary[0].example,'');assert.ok(!JSON.stringify(result.vocabulary).includes(only));
});
