import test from 'node:test';import assert from 'node:assert/strict';
import {createCatalogClient} from './catalog-client.mjs';
const make=(label,revision=1)=>({labelId:label,releaseId:'release_001',title:'Album',releaseDate:'2026-10-18',works:[{workId:'work_0001',title:'Work'}],tracks:[{trackId:'track_0001',title:'Song',isrc:'USABC1234567',workIds:['work_0001']}],source:{system:'engine',revision,observedAtMs:1000}});
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('uses same-origin BFF with no browser API key',async()=>{
 const client=createCatalogClient({expectedSource:'engine',now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/catalog');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.authorization,undefined);return json(make('label_0001'));
 }});
 assert.equal((await client.load('label_0001')).releaseId,'release_001');
 await assert.rejects(()=>client.load('label_0001'),/Stale catalog revision/);
});
test('old in-flight label result is discarded after scope switch',async()=>{
 let releaseFirst;
 const client=createCatalogClient({expectedSource:'engine',now:()=>2000,fetchImpl:async url=>{
  if(url.includes('label_0001')) return new Promise(resolve=>{releaseFirst=()=>resolve(json(make('label_0001')));});
  return json(make('label_0002'));
 }});
 const old=client.load('label_0001');
 const current=await client.load('label_0002');assert.equal(current.labelId,'label_0002');
 releaseFirst();await assert.rejects(old,/superseded/);
});
test('wrong label and missing report fail closed',async()=>{
 const wrong=createCatalogClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>json(make('label_0002'))});
 await assert.rejects(()=>wrong.load('label_0001'));
 const missing=createCatalogClient({expectedSource:'engine',fetchImpl:async()=>new Response('',{status:404})});
 await assert.rejects(()=>missing.load('label_0001'),/unavailable/);
});
