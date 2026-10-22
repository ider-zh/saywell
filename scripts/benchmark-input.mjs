// Synthetic-only microbenchmarks. Run explicitly; never reads a user's editor or a provider.
import {mkdir,writeFile} from 'node:fs/promises';import {typingDelta} from '../src/core/analytics.js';import {practiceDiff} from '../src/core/practice-diff.js';
const label=process.argv[2] || 'current',rows=[];
for(const length of [6000,60000,600000]){
  const before='A synthetic writing sentence. '.repeat(Math.ceil(length/30)).slice(0,length),after=before+'x';
  for(let i=0;i<3;i++)typingDelta(before,after,'insertText','x');
  const times=[];for(let i=0;i<20;i++){const start=performance.now();typingDelta(before,after,'insertText','x');times.push(performance.now()-start);}times.sort((a,b)=>a-b);rows.push({task:'typing',length,medianMs:times[10],p95Ms:times[18]});
}
const expected='A short synthetic sentence with several words. '.repeat(9),actual=expected.toUpperCase();
const times=[];for(let i=0;i<12;i++){const start=performance.now();practiceDiff(expected,actual);times.push(performance.now()-start);}times.sort((a,b)=>a-b);rows.push({task:'practice-case-diff',length:expected.length,medianMs:times[6],p95Ms:times[10]});
await mkdir('test-results',{recursive:true});await writeFile(`test-results/input-benchmark-${label}.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({label,rows}));
