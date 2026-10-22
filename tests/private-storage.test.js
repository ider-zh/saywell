import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateStorage} from '../src/core/private-storage.js';
function fixture(){
  const stores={disk:{},memory:{}};
  const area=id=>({get:async names=>Object.fromEntries((typeof names==='string'?[names]:names).filter(name=>stores[id][name]!==undefined).map(name=>[name,structuredClone(stores[id][name])])),set:async values=>Object.assign(stores[id],structuredClone(values)),remove:async names=>{for(const name of typeof names==='string'?[names]:names)delete stores[id][name];}});
  const disk=area('disk'),memory=area('memory');return {stores,disk,memory,storage:createPrivateStorage(disk,memory)};
}
const password='Synthetic vault password 2026';
test('default private records stay encrypted in session memory, and persistent keys require a vault',async()=>{
  const {stores,storage}=fixture();await storage.set({translationHistory:[{source:'private synthetic draft'}],analytics:{host:'fixture.test'},vocabulary:[{context:'private context'}]});
  assert.deepEqual(await storage.get('translationHistory'),{translationHistory:[{source:'private synthetic draft'}]});assert.deepEqual(stores.disk,{});
  assert.ok(!JSON.stringify(stores.memory).includes('private synthetic draft'));await assert.rejects(storage.set({keys:{llm:'secret'}}),/Create and unlock/);
  assert.equal((await storage.status()).sessionOnly,true);
});
test('password-wrapped AES-GCM vault survives browser restart, refuses wrong passwords and never stores its data key on disk',async()=>{
  const f=fixture();await f.storage.set({translationHistory:[{source:'protected source'}]});await f.storage.create(password);await f.storage.set({keys:{llm:'synthetic-private-key'}});
  const disk=JSON.stringify(f.stores.disk),raw=f.stores.memory.saywellPrivateSession.key;
  for(const secret of ['protected source','synthetic-private-key',password,raw])assert.ok(!disk.includes(secret));
  f.stores.memory={};let reopened=createPrivateStorage(f.disk,f.memory);assert.equal((await reopened.status()).locked,true);assert.deepEqual(await reopened.get('keys'),{});
  await assert.rejects(reopened.set({translationHistory:[]}),/Unlock/);await assert.rejects(reopened.unlock('Incorrect synthetic password'),/incorrect/);assert.equal(JSON.stringify(f.stores.disk),disk);
  await reopened.unlock(password);assert.equal((await reopened.get('keys')).keys.llm,'synthetic-private-key');assert.equal((await reopened.get('translationHistory')).translationHistory[0].source,'protected source');
  await reopened.lock();assert.equal((await reopened.status()).locked,true);assert.equal(f.stores.memory.saywellPrivateSession,undefined);
});
test('envelopes use fresh IVs and bind ciphertext to its field and vault identity; tampering never becomes plaintext',async()=>{
  const {stores,storage}=fixture();await storage.create(password);await storage.set({keys:{llm:'test-key'},translationHistory:[]});const before=stores.disk.saywellPrivateData.keys;
  await storage.set({keys:{llm:'test-key'}});assert.notEqual(stores.disk.saywellPrivateData.keys.iv,before.iv);
  stores.disk.saywellPrivateData.translationHistory=stores.disk.saywellPrivateData.keys;await assert.rejects(storage.get('translationHistory'),/could not be opened/);
  const cipher=stores.disk.saywellPrivateData.keys.ciphertext;stores.disk.saywellPrivateData.keys.ciphertext=(cipher[0]==='A'?'B':'A')+cipher.slice(1);await assert.rejects(storage.get('keys'),/could not be opened/);
});
test('legacy plaintext migrates before removal, cannot overwrite current session credentials and is retained if replacement fails',async()=>{
  const f=fixture();f.stores.disk={translationHistory:[{source:'old draft'}],keys:{llm:'old key'},settings:{llm:{rememberKey:true}}};f.stores.memory.keys={llm:'new key'};
  await f.storage.initialize();assert.equal(f.stores.disk.translationHistory,undefined);assert.equal(f.stores.disk.keys,undefined);assert.equal(f.stores.memory.keys.llm,'new key');assert.equal(f.stores.disk.settings.llm.rememberKey,false);assert.equal((await f.storage.get('translationHistory')).translationHistory[0].source,'old draft');
  await f.storage.create(password);f.stores.memory={};await f.storage.unlock(password);assert.equal((await f.storage.get('translationHistory')).translationHistory[0].source,'old draft');
  const failed=fixture();failed.stores.disk.translationHistory=[{source:'do not lose'}];failed.memory.set=async()=>{throw new Error('Storage unavailable');};await assert.rejects(failed.storage.initialize());assert.equal(failed.stores.disk.translationHistory[0].source,'do not lose');
});
test('serialized private writes preserve unrelated fields and explicit erase clears locked private data',async()=>{
  const {storage,stores}=fixture();await Promise.all([storage.set({translationHistory:[1]}),storage.set({vocabulary:[2]})]);assert.deepEqual(await storage.get(['translationHistory','vocabulary']),{translationHistory:[1],vocabulary:[2]});
  await storage.create(password);await storage.lock();await storage.erase();assert.deepEqual(stores.disk,{});assert.equal((await storage.status()).configured,false);
});
test('erasing a vault clears remembered-key preferences so session credentials remain usable',async()=>{
  const {storage,stores}=fixture();await storage.create(password);await storage.set({settings:{llm:{rememberKey:true},llmProfiles:[{id:'default',rememberKey:true}],basic:{azure:{rememberKey:true}}}});
  await storage.lock();await storage.erase();
  for(const cfg of [stores.disk.settings.llm,...stores.disk.settings.llmProfiles,...Object.values(stores.disk.settings.basic)])assert.equal(cfg.rememberKey,false);
  assert.equal((await storage.status()).sessionOnly,true);
});
