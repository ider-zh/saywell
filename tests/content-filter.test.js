import test from 'node:test';import assert from 'node:assert/strict';
import {shouldSkipAutomaticContent} from '../src/core/content-filter.js';

test('automatic prefilter recognizes complete addresses, numeric data and clear identifiers',()=>{
  for(const text of [
    'https://example.com/path?q=123','www.example.com','example.com/a','user@example.com','127.0.0.1','2001:db8::1','[::1]',
    '123456','１，２３４.５０','2026-10-23','2026-10-23T12:30:00Z','10:25','+86 138 0000 0000','$1,234.50','￥ 123.45','50%','USD 120.00',
    '1\n2\n3','ID123','ID: 123','ID: AB-123','AB-123','ABC123','order_123','user_92837','550e8400-e29b-41d4-a716-446655440000','0123456789abcdef','0x00ff',
    'https://example.com\nuser@example.com\nAB-123 42','AB-123, CD-456'
  ])assert.equal(shouldSkipAutomaticContent(text),true,text);
});
test('automatic prefilter preserves ordinary words and prose mixed with numbers or addresses',()=>{
  for(const text of [
    'Hello','OK','go','ID','USD','version2','v2','Hello 123','123 kg','Room 123','Hello, world.','请访问 https://example.com','邮件发到 user@example.com。',
    'My ID is AB-123.','订单号是 AB-123','This costs $120.','2026-10-23 开会','Example sentence with 123 numbers.','ordinary_word','read-this-2',
    'Please translate the website address https://example.com.','identifier123'
  ])assert.equal(shouldSkipAutomaticContent(text),false,text);
  assert.equal(shouldSkipAutomaticContent(''),false);assert.equal(shouldSkipAutomaticContent(null),false);assert.equal(shouldSkipAutomaticContent('A'.repeat(100000)),false);
});
