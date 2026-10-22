import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchText,fetchJSON} from '../src/providers/http.js';

test('provider responses stop reading and cancel once the decoded limit is exceeded',async()=>{
  let pulls=0,cancelled=false;
  const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new TextEncoder().encode('x'.repeat(10)));},cancel(){cancelled=true;}});
  const response=new Response(stream,{headers:{'Content-Length':'1'}});
  response.text=()=>{throw new Error('Must not buffer the entire body.');};
  await assert.rejects(fetchText('https://synthetic.test',{},1000,async()=>response,20),error=>error.code==='response');
  assert.equal(cancelled,true);assert.ok(pulls<=4,'an endless stream must be cancelled after bounded reads');
});

test('streamed UTF-8 retains split multibyte characters and the existing text-length limit',async()=>{
  const text='中😀文',bytes=new TextEncoder().encode(text);let at=0;
  const response=()=>new Response(new ReadableStream({pull(controller){if(at<bytes.length)controller.enqueue(bytes.slice(at,++at));else controller.close();}}));
  assert.equal(await fetchText('https://synthetic.test',{},1000,response,4),text);
  at=0;await assert.rejects(fetchText('https://synthetic.test',{},1000,response,3),error=>error.code==='response');
});

test('provider timeout also cancels a stalled response body without waiting for its cancel hook',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{});}}));
  await assert.rejects(fetchText('https://synthetic.test',{},10,async()=>response),error=>error.code==='timeout');
  assert.equal(cancelled,true);
});

test('HTTP failures cancel their unused body and preserve safe status errors',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:401});
  await assert.rejects(fetchJSON('https://synthetic.test',{},1000,async()=>response),error=>error.code==='auth'&&!error.message.includes('synthetic'));
  assert.equal(cancelled,true);
});
