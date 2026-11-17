import test from 'node:test';import assert from 'node:assert/strict';
import {specialSpans,specialSegments,protectSpecialContent} from '../src/core/special-content.js';
import {shouldSkipAutomaticContent} from '../src/core/content-filter.js';
import {classify,translationPair} from '../src/core/language.js';

test('special spans preserve punctuation, balanced URLs, quoted paths, relative files, email and IDs',()=>{
  const source='请看 https://example.com/a(b)?q=1。邮箱 dev+test@example.com，路径 "C:\\Program Files\\报告.txt" 和 /tmp/a.json，src/app.js，编号 AB-123。';
  assert.deepEqual(specialSpans(source).map(({kind,value})=>[kind,value]),[
    ['URL','https://example.com/a(b)?q=1'],['EMAIL','dev+test@example.com'],['PATH','C:\\Program Files\\报告.txt'],['PATH','/tmp/a.json'],['PATH','src/app.js'],['ID','AB-123']
  ]);
  const protectedText=protectSpecialContent(source);assert.equal(protectedText.restore(protectedText.text,{complete:true}),source);
  assert.equal(specialSpans('Please improve this sentence and/or the next.').length,0);
  assert.deepEqual(specialSpans('example.com/file.txt').map(s=>s.kind),['URL']);
  assert.equal(specialSpans('example.company').length,0);
  for(const text of ['C:\\demo\\x.txt','"C:\\Program Files\\x.txt"','/tmp/report.txt','./file.txt','~/notes/a.md','src/app.js'])assert.equal(shouldSkipAutomaticContent(text),true,text);
  assert.equal(shouldSkipAutomaticContent('检查 src/app.js'),false);
});

test('restoration accepts reordering and repeated source values, but rejects lost, changed, duplicate or foreign placeholders',()=>{
  const source='Write to a@example.com, then a@example.com; read /tmp/a.txt.';
  const p=protectSpecialContent(source),tokens=p.text.match(/__SWP_[a-f0-9]+_[A-Z]+_\d+__/g);
  assert.equal(new Set(tokens).size,3);
  assert.equal(p.restore(tokens.toReversed().join(' '),{complete:true}),'/tmp/a.txt a@example.com a@example.com');
  for(const output of [p.text.replace(tokens[0],''),p.text+tokens[0],p.text.replace(tokens[0],tokens[0].toLowerCase()),p.text+' __SWP_0000000000000000_URL_99__'])assert.throws(()=>p.restore(output,{complete:true}));
  assert.throws(()=>p.restore(p.text,{complete:true,limit:10}));
  assert.equal(p.restore('See '+tokens[0]),'See a@example.com');
});

test('display segments collapse only exact original values and leave modified MT addresses visible',()=>{
  const source='联系 a@example.com，查看 https://example.com/a。';
  const output='Email a@example.com; visit https://example.com/changed.';
  const parts=specialSegments(output,source);assert.equal(parts.filter(p=>p.kind).length,1);assert.equal(parts.find(p=>p.kind).text,'a@example.com');
  assert.equal(parts.map(p=>p.text).join(''),output);assert.ok(parts.some(p=>!p.kind && p.text.includes('https://example.com/changed')));
});

test('mask maps are request-local and oversized masking fails before any send',()=>{
  const a=protectSpecialContent('Check a@example.com.'),b=protectSpecialContent('Check a@example.com.');assert.notEqual(a.text,b.text);assert.throws(()=>b.restore(a.text,{complete:true}));
  assert.throws(()=>protectSpecialContent(('a@b.co ').repeat(600)));
  const literal='Show __SWP_0000000000000000_URL_1__ and a@example.com.';
  const p=protectSpecialContent(literal);assert.equal(p.restore(p.text,{complete:true}),literal);
});

test('routing uses prose language even when an address or filename dominates the draft',()=>{
  const chinese='请检查 https://example.com/'+ 'english-identifier-'.repeat(40);
  assert.equal(classify(chinese),'chinese');assert.deepEqual(translationPair(chinese,'en'),{source:'zh',target:'en'});
  const english='Please check "C:\\'+ '中文文件夹'.repeat(40)+'\\报告.txt".';
  assert.equal(classify(english),'english');assert.deepEqual(translationPair(english,'zh'),{source:'en',target:'zh'});
  assert.equal(classify('https://example.com'),'english');
});
