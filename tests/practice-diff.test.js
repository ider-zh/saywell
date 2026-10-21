import test from 'node:test';import assert from 'node:assert/strict';
import {practiceDiff} from '../src/core/practice-diff.js';
test('practice diff aligns letters and treats case, punctuation and spacing as secondary',()=>{
  const exact=practiceDiff('Hello, world.','Hello, world.');assert.equal(exact.complete,true);assert.equal(exact.major,0);assert.equal(exact.minor,0);
  const secondary=practiceDiff('Hello, world.','hello world!');assert.equal(secondary.complete,true);assert.equal(secondary.major,0);assert.ok(secondary.minor>0);assert.ok(secondary.input.some(part=>part.kind==='minor'));
  for(const value of ['Helo, world.','Hello, word.','Hello, worlds.','Hallo, world.']){const diff=practiceDiff('Hello, world.',value);assert.equal(diff.complete,false);assert.equal(diff.major,1,value);}
  const partial=practiceDiff('Hello, world.','Hello');assert.equal(partial.major,0);assert.equal(partial.complete,false);assert.ok(partial.target.some(part=>part.kind==='pending'));
  const chinese=practiceDiff('你好，世界。','你好 世界!');assert.equal(chinese.major,0);assert.equal(chinese.complete,true);
  const hostile=practiceDiff('<img src=x>','<img src=y>');assert.equal(hostile.major,1);assert.equal(hostile.input.map(part=>part.text).join(''),'<img src=y>');
});
test('practice diff bounds work for long input, preserves Unicode text and marks an empty attempt pending',()=>{
  const target='This is a long synthetic sentence. '.repeat(500),input='That is a long synthetic sentence. '.repeat(170),before=performance.now(),diff=practiceDiff(target,input);
  assert.ok(performance.now()-before<1000);assert.equal(diff.input.map(part=>part.text).join(''),input);assert.equal(diff.target.map(part=>part.text).join(''),target);assert.ok(diff.major>0);
  assert.equal(practiceDiff('你好 🌍。','你好 🌍。').complete,true);assert.equal(practiceDiff('Hi.','').complete,false);assert.equal(practiceDiff('Hi.','').major,0);
});
