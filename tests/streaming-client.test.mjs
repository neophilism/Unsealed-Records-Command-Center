import test from 'node:test';import assert from 'node:assert/strict';
import {createStreamingClient} from '../src/streaming-client.mjs';
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
test('filters cannot override label/source/clock authorization context',async()=>{
 let calls=0;const client=createStreamingClient({expectedSource:'engine',fetchImpl:async()=>{calls++;return json('label_0001',1);}});
 for(const filters of [{requestedLabelId:'label_0002'},{expectedSource:'untrusted'},{nowMs:0},{freshnessMs:Infinity},[]])
  await assert.rejects(client.load('label_0001',filters),/Invalid streaming filters/);
 assert.equal(calls,0);
});
test('all observed keys are guarded across filter changes; conflicting equal revisions fail',async()=>{
 let gbRevision=4,streams='9';
 const client=createStreamingClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>new Response(JSON.stringify({labelId:'label_0001',records:[record('label_0001',1),
  {...record('label_0001',gbRevision),country:'GB',streams}]}),{headers:{'content-type':'application/json'}})});
 await client.load('label_0001',{country:'US'});gbRevision=3;
 await assert.rejects(client.load('label_0001',{country:'GB'}),/Stale streaming revision/);
 gbRevision=4;streams='10';await assert.rejects(client.load('label_0001',{country:'GB'}),/Stale streaming revision/);
 gbRevision=5;assert.equal((await client.load('label_0001',{country:'GB'})).totalStreams,'10');
});
test('within-response order does not discard the newest source revision',async()=>{
 const client=createStreamingClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>new Response(JSON.stringify({labelId:'label_0001',records:[record('label_0001',2),record('label_0001',1)]}),{headers:{'content-type':'application/json'}})});
 assert.equal((await client.load('label_0001')).records[0].source.revision,2);
});
test('body bounds, deadlines and provider failures have safe public errors',async()=>{
 let cancelled=false;
 const oversized=createStreamingClient({expectedSource:'engine',fetchImpl:async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(200001));},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}})});
 await assert.rejects(oversized.load('label_0001'),/^Error: Streaming data unavailable$/);assert.equal(cancelled,true);
 const stalled=createStreamingClient({expectedSource:'engine',timeoutMs:20,fetchImpl:async()=>new Response(new ReadableStream(),{headers:{'content-type':'application/json'}})});
 await assert.rejects(stalled.load('label_0001'),/timed out/);
 const failed=createStreamingClient({expectedSource:'engine',fetchImpl:async()=>{throw new Error('provider password');}});
 await assert.rejects(failed.load('label_0001'),/^Error: Streaming data unavailable$/);
});
