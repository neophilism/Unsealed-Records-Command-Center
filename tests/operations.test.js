import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {scopeQuery,scopeOptions,matchesScope,rankReleases,formatInteger,formatPoints} from '../src/operations.js';

test('Label/family selections are encoded as a single bounded query selector',()=>{
  assert.equal(scopeQuery('all'),'');assert.equal(scopeQuery('label:label-a'),'?labelId=label-a');
  assert.equal(scopeQuery('family:family:a'),'?familyId=family%3Aa');
  assert.throws(()=>scopeQuery('label:alpha&labelId=hidden'));assert.throws(()=>scopeQuery('family:'));
  assert.deepEqual(scopeOptions({labels:[{id:'a',name:'Alpha'}],families:[{id:'f',name:'Group'}]}).map(o=>o.value),['all','family:f','label:a']);
});
test('An older or mismatched selection cannot be shown as the new label report',()=>{
  const summary={counts:{sales:1},scope:{labelIds:['alpha'],familyId:null}};
  assert.equal(matchesScope('label:alpha',summary),true);assert.equal(matchesScope('label:beta',summary),false);
  assert.equal(matchesScope('family:f',summary),false);assert.equal(matchesScope('all',summary),true);
  assert.equal(matchesScope('all',{}),false);
});
test('Release display uses separate canonical rows and preserves exact large counter ordering',()=>{
  const rows=rankReleases({'label-a/id':{title:'Same Album',streams:'9007199254740993'},'label-b/id':{title:'Same Album',streams:'9007199254740994'}});
  assert.equal(rows.length,2);assert.equal(rows[0][0],'label-b/id');assert.equal(rows[0][1].title,'Same Album');
  assert.equal(formatInteger('9007199254740993'),'9,007,199,254,740,993');
  assert.equal(formatPoints('1500000'),'1.5');assert.equal(formatPoints('3'),'0.000003');
  assert.equal(formatPoints('9007199254740993000'),'9,007,199,254,740.993');
});
test('Production bundle contains no server key reference',async()=>{
  const files=await readdir('dist/assets');
  const code=(await Promise.all(files.filter(f=>f.endsWith('.js')).map(f=>readFile('dist/assets/'+f,'utf8')))).join('\n');
  assert.ok(code.length > 0);assert.equal(code.includes('ENGINE_API_KEY'),false);assert.equal(code.includes('ENGINE_INTERNAL_URL'),false);
  assert.equal(code.includes('command-center-build-only-secret-1234567890'),false);
});
