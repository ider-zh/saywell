import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {typingDelta} from '../../src/core/analytics.js';import {createPracticeComparer} from '../../src/core/practice-diff.js';import {CORE_BUDGETS} from '../performance-budgets.js';
import {protectSpecialContent,specialSegments} from '../../src/core/special-content.js';
import {classify} from '../../src/core/language.js';
test('input statistics and practice comparison stay within their regression budgets',async()=>{
  const expected='A short synthetic sentence with several words. '.repeat(9),compare=createPracticeComparer(expected),rows=[];
  const cases=[...[[60000,'typing60kMedianMs'],[600000,'typing600kMedianMs']].map(([length,key])=>{const before='A synthetic writing sentence. '.repeat(Math.ceil(length/30)).slice(0,length),after=before+'x';return {key,length,run:()=>typingDelta(before,after,'insertText','x')};}),{key:'practiceCaseMedianMs',length:expected.length,run:()=>compare(expected.toUpperCase())},{key:'practiceEditMedianMs',length:expected.length,run:()=>compare('X'+expected.slice(1))}];
  const protectedSource=('Review https://example.com/a and email dev@example.com. '.repeat(16)+'A natural sentence. '.repeat(300)).slice(0,5000);
  cases.push({key:'protectedContentMedianMs',length:protectedSource.length,run:()=>{const value=protectSpecialContent(protectedSource);value.restore(value.text,{complete:true});specialSegments(protectedSource,protectedSource);}});
  const mixedSource=('请检查 https://example.com/'+ 'english-reference-'.repeat(300)).slice(0,5000);
  cases.push({key:'mixedRoutingMedianMs',length:mixedSource.length,run:()=>classify(mixedSource)});
  for(const {key,length,run} of cases){for(let i=0;i<5;i++)run();const times=[];for(let i=0;i<25;i++){const start=performance.now();run();times.push(performance.now()-start);}times.sort((a,b)=>a-b);rows.push({metric:key,length,samples:times.length,medianMs:times[12],p95Ms:times[23],budgetMs:CORE_BUDGETS[key]});}
  await mkdir('performance-results',{recursive:true});await writeFile('performance-results/core.json',JSON.stringify({schema:1,rows},null,2));console.log('Core performance budgets: '+JSON.stringify(rows));
  for(const row of rows)assert.ok(row.medianMs<=row.budgetMs,`${row.metric}: ${row.medianMs.toFixed(2)} ms exceeds ${row.budgetMs} ms; inspect performance-results/core.json before changing a budget.`);
});
