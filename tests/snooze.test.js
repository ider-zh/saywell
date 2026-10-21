import test from 'node:test';import assert from 'node:assert/strict';
import {snoozeDeadline,snoozeStatus,changeSnooze} from '../src/core/snooze.js';
test('temporary pause uses fixed hour intervals or the next local midnight and expires without a cleanup task',()=>{
  const now=new Date(2026,9,21,17,30).getTime();assert.equal(snoozeDeadline('1h',now),now+3600000);assert.equal(snoozeDeadline('4h',now),now+14400000);assert.equal(snoozeDeadline('tomorrow',now),new Date(2026,9,22).getTime());assert.throws(()=>snoozeDeadline('forever',now));
  const first=changeSnooze({},'site','one.example',now+3600000,now),both=changeSnooze(first,'all','two.example',now+14400000,now);
  assert.equal(snoozeStatus(first,'two.example',now).until,0);assert.equal(snoozeStatus(both,'one.example',now).until,now+14400000);
  const resumed=changeSnooze(both,'all',null,0,now);assert.equal(snoozeStatus(resumed,'one.example',now).until,now+3600000);assert.equal(snoozeStatus(resumed,'one.example',now+3600000).until,0);
  assert.equal(snoozeStatus(changeSnooze(first,'site','one.example',0,now),'one.example',now).until,0);assert.equal(snoozeStatus({all:NaN,sites:{x:'unsafe'}},'x',now).until,0);
});
