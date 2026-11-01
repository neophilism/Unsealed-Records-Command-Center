import test from 'node:test';import assert from 'node:assert/strict';
import {createCatalogClient} from '../src/catalog-client.mjs';
const make=(label,revision=1)=>({labelId:label,releaseId:'release_001',title:'Album',releaseDate:'2026-10-18',works:[{workId:'work_0001',title:'Work'}],tracks:[{trackId:'track_0001',title:'Song',isrc:'USABC1234567',workIds:['work_0001']}],source:{system:'engine',status:'cached',revision,observedAtMs:1000}});
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('uses same-origin BFF with no browser API key',async()=>{
 const client=createCatalogClient({expectedSource:'engine',now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/catalog');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.authorization,undefined);return json(make('label_0001'));
 }});
 assert.equal((await client.load('label_0001')).releaseId,'release_001');
 assert.equal((await client.load('label_0001')).releaseId,'release_001');
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
test('identical retries are idempotent but conflicting and out-of-order revisions are rejected',async()=>{
 let revision=4,title='Original';
 const client=createCatalogClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>json({...make('label_0001',revision),title})});
 assert.equal((await client.load('label_0001')).title,'Original');
 assert.equal((await client.load('label_0001')).title,'Original');
 title='Conflicting';await assert.rejects(client.load('label_0001'),/Stale catalog revision/);
 revision=3;await assert.rejects(client.load('label_0001'),/Stale catalog revision/);
 revision=5;assert.equal((await client.load('label_0001')).title,'Conflicting');
});
test('client cancels oversized and stalled bodies and never exposes provider diagnostics',async()=>{
 let cancelled=false;
 const large=new ReadableStream({pull(c){c.enqueue(new Uint8Array(100001));},cancel(){cancelled=true;}});
 const client=createCatalogClient({expectedSource:'engine',fetchImpl:async()=>new Response(large,{headers:{'content-type':'application/json'}})});
 await assert.rejects(client.load('label_0001'),/^Error: Catalog unavailable$/);assert.equal(cancelled,true);
 const stalled=createCatalogClient({expectedSource:'engine',timeoutMs:20,fetchImpl:async()=>new Response(new ReadableStream(),{headers:{'content-type':'application/json'}})});
 await assert.rejects(stalled.load('label_0001'),/timed out/);
 const error=createCatalogClient({expectedSource:'engine',fetchImpl:async()=>{throw new Error('private provider credential');}});
 await assert.rejects(error.load('label_0001'),/^Error: Catalog unavailable$/);
});
test('scope cancellation while streaming rejects old data and preserves the next request',async()=>{
 let cancelled=false;
 const client=createCatalogClient({expectedSource:'engine',now:()=>2000,fetchImpl:async url=>{
  if(url.includes('label_0001')) return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});
  return json(make('label_0002'));
 }});
 const old=client.load('label_0001');
 // Let the old stream reader attach its cancellation listener.
 await new Promise(resolve=>setImmediate(resolve));
 const rejection=assert.rejects(old,/superseded/);
 assert.equal((await client.load('label_0002')).labelId,'label_0002');
 await rejection;assert.equal(cancelled,true);
});
