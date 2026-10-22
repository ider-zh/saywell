import test from 'node:test';import assert from 'node:assert/strict';
import {releaseVersion} from '../scripts/release-version.mjs';
test('release tag must match both package and Chrome manifest versions',()=>{
  assert.deepEqual(releaseVersion('refs/tags/v0.1.0','0.1.0','0.1.0'),{version:'0.1.0',artifactName:'saywell-0.1.0.zip'});
  assert.throws(()=>releaseVersion('refs/tags/v0.1.1','0.1.0','0.1.0'),/Release tag/);
  assert.throws(()=>releaseVersion('refs/tags/v0.1.0','0.1.0','0.1.1'),/must match/);
  assert.throws(()=>releaseVersion('refs/tags/v0.1.0','0.1.0','0.1.0',['0.1.0','0.0.9']),/lock versions/);
  assert.throws(()=>releaseVersion('refs/tags/v0.1.0;bad','0.1.0','0.1.0'),/Release tag/);
});
test('ordinary CI refs validate packaging without requiring a version tag and reject invalid Chrome versions',()=>{
  for(const ref of ['refs/heads/main','refs/pull/12/merge'])assert.equal(releaseVersion(ref,'0.1.0','0.1.0').version,'0.1.0');
  for(const version of ['0.0.0','01.2.3','1.2.3-beta','1.2.65536','1.2','1.2.3.4.5'])assert.throws(()=>releaseVersion('refs/heads/main',version,version),/valid numeric/);
});
