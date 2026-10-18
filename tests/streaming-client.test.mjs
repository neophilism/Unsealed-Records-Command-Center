import test from 'node:test';import assert from 'node:assert/strict';
import {createStreamingClient} from './streaming-client.mjs';
const record=(label,revision=1)=>({labelId:label,period:'2026-10',country:'US',platform:'spotify',streams:'9',source:{system:'engine',kind:'live',revision,observedAtMs:1000}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,records:[record(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin streaming request applies filters without provider credentials',async()=>{
 const client=createStreamingClient({expectedSource:'engine',now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/streams');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.authorization,undefined);return json('label_0001',1);
 }});
 const value=await client.load('label_0001',{country:'US'});assert.equal(value.totalStreams,'9');
 const missing=await client.load('label_0001',{country:'GB'});assert.equal(missing.availability,'awaiting');assert.equal(missing.totalStreams,null);
});
test('scope switch drops older in-flight response',async()=>{
 let releaseFirst;
 const client=createStreamingClient({expectedSource:'engine',now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{releaseFirst=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).labelId,'label_0002');
 releaseFirst();await assert.rejects(old,/superseded/);
});
test('older revision across requests fails closed',async()=>{
 let revision=2;
 const client=createStreamingClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>json('label_0001',revision)});
 await client.load('label_0001');revision=1;await assert.rejects(()=>client.load('label_0001'),/Stale streaming revision/);
});
