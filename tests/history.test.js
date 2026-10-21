import test from 'node:test';import assert from 'node:assert/strict';
import {historyLimit,historyResult,mergeHistory,trimHistory,HISTORY_BYTES} from '../src/core/history.js';
test('history defaults to 100, merges parallel lanes without reordering, strips unknown result fields and rolls old records',()=>{
  assert.equal(historyLimit(undefined),100);assert.equal(historyLimit(0),0);assert.equal(historyLimit(17),100);
  const first={id:'first',source:'你好',hostname:'example.test',targetLanguage:'en',createdAt:'2026-10-21T00:00:00Z'},second={...first,id:'second',source:'再见'};
  let records=mergeHistory([],first,'mt',historyResult({text:'Hello',engine:'MT',key:'omit-key'}),100);
  records=mergeHistory(records,second,'mt',{text:'Bye',engine:'MT'},100);records=mergeHistory(records,first,'llm',{text:'Hello.',engine:'LLM'},100);
  assert.deepEqual(records.map(row=>row.id),['second','first']);assert.deepEqual(Object.keys(records[1].results),['mt','llm']);assert.equal(records[1].results.mt.key,undefined);
  assert.deepEqual(trimHistory(records,1).map(row=>row.id),['second']);assert.throws(()=>mergeHistory(records,{...first,source:'changed'},'mt',{text:'invalid',engine:'MT'},100));
  for(const result of [null,{text:'',engine:'MT'},{text:'a'.repeat(20001),engine:'MT'},{text:'ok',engine:[]}])assert.throws(()=>historyResult(result));
});
test('history has a UTF-8 byte ceiling in addition to the selected row limit',()=>{
  const rows=Array.from({length:1000},(_,i)=>({id:String(i),source:'汉'.repeat(6000),results:{llm:{text:'译'.repeat(20000),engine:'LLM'}}}));
  const kept=trimHistory(rows,1000);assert.ok(kept.length>0 && kept.length<100);assert.ok(new TextEncoder().encode(JSON.stringify(kept)).length<=HISTORY_BYTES);assert.equal(kept[0].id,'0');
});
