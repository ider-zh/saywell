import test from 'node:test';import assert from 'node:assert/strict';
import {insertedSpan,countEnglish,countChars} from '../src/core/language.js';import {typingDelta} from '../src/core/analytics.js';import {createPracticeComparer} from '../src/core/practice-diff.js';
const reference=(before,after)=>{const a=Array.from(before),b=Array.from(after);let left=0,right=0;while(left<a.length && left<b.length && a[left]===b[left])left++;while(right<a.length-left && right<b.length-left && a[a.length-1-right]===b[b.length-1-right])right++;return {text:b.slice(left,b.length-right).join(''),before:a.slice(0,left).join(''),after:b.slice(b.length-right).join('')};};
test('allocation-free span diff preserves code-point boundaries, including split surrogate edits',()=>{
  let seed=9;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;},alphabet=['a','b',' ','😀','🀀','你','\ud800','\udc00','\n'];
  const word=()=>Array.from({length:random()%16},()=>alphabet[random()%alphabet.length]).join('');
  for(let i=0;i<800;i++){const before=word(),after=i%2?word():before+word();assert.deepEqual(insertedSpan(before,after),reference(before,after));assert.equal(countChars(before),Array.from(before).length);}
  assert.deepEqual(insertedSpan('\ud800','\ud800\udc00'),{text:'𐀀',before:'',after:''});
});
test('bounded English boundary counting agrees with full-prefix counting across punctuation and word joins',()=>{
  let seed=17;const alphabet="ab '-’_你😀",word=()=>{let result='';for(let i=0;i<16;i++){seed=(seed*1664525+1013904223)>>>0;result+=alphabet[seed%alphabet.length];}return result;};
  for(let i=0;i<800;i++){const before=word(),data=word().slice(0,7),after=before+data,diff=reference(before,after);assert.equal(typingDelta(before,after,'insertText',data).english,Math.max(0,countEnglish(diff.before+data)-countEnglish(diff.before)));}
  const prefix='long synthetic paragraph '.repeat(10000);assert.equal(typingDelta(prefix,prefix+'word','insertText','word').english,1);
});
test('cached practice comparer keeps attempts independent and preserves minor differences and pending suffixes',()=>{
  const compare=createPracticeComparer('Hello, world.');assert.equal(compare('HELLO, WORLD.').major,0);assert.equal(compare('Hello, word.').major,1);assert.equal(compare('Hello, world.').minor,0);assert.equal(compare('Hello').complete,false);assert.equal(compare('hello,').complete,false);assert.equal(compare('hello world!').complete,true);
  const unicode=createPracticeComparer('Ａa')('aa');assert.equal(unicode.complete,true);assert.equal(unicode.minor,1);
});
