import test from 'node:test';import assert from 'node:assert/strict';
import {createTooLostClient} from '../src/toolost-client.mjs';
const statement=(label,revision=1)=>({provider:'TooLost',statementId:'statement_001',labelId:label,period:'2026-10',currency:'USD',royaltiesMinor:'20',lines:[{lineId:'line_0001',releaseId:'release_001',trackId:'track_0001',kind:'royalty',units:'1',royaltyMinor:'20'}],source:{system:'TooLost',kind:'live',revision,observedAtMs:1000,documentSha256:'a'.repeat(64)}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,statements:[statement(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin statement request carries no provider key and validates label',async()=>{
 const client=createTooLostClient({now:()=>2000,fetchImpl:async(url,opts)=>{
  assert.equal(url,'/api/labels/label_0001/reports/toolost');assert.equal(opts.credentials,'same-origin');assert.equal(opts.headers.authorization,undefined);return json('label_0001',1);
 }});
 assert.equal((await client.load('label_0001','statement_001')).royaltiesMinor,'20');
 const wrong=createTooLostClient({now:()=>2000,fetchImpl:async()=>json('label_0002',1)});
 await assert.rejects(()=>wrong.load('label_0001','statement_001'));
});
test('scope switch discards old statement and later revision cannot regress',async()=>{
 let release;
 const client=createTooLostClient({now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001','statement_001');assert.equal((await client.load('label_0002','statement_001')).labelId,'label_0002');
 release();await assert.rejects(old,/superseded/);
 let revision=2;
 const next=createTooLostClient({now:()=>2000,fetchImpl:async()=>json('label_0001',revision)});
 await next.load('label_0001','statement_001');revision=1;
 await assert.rejects(()=>next.load('label_0001','statement_001'),/Stale statement revision/);
});
test('synthetic statements require explicit selection and cannot overwrite observed statement ids',async()=>{
 const payload={labelId:'label_0001',statements:[statement('label_0001',1),{...statement('label_0001',99),source:{...statement('label_0001',99).source,kind:'synthetic'}}]};
 const client=createTooLostClient({now:()=>2000,fetchImpl:async()=>new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})});
 assert.equal((await client.load('label_0001','statement_001')).source.kind,'live');
 assert.equal((await client.load('label_0001','statement_001',{sourceKind:'synthetic'})).source.kind,'synthetic');
 assert.equal((await client.load('label_0001','statement_001')).source.revision,1);
 const onlyDemo=createTooLostClient({now:()=>2000,fetchImpl:async()=>new Response(JSON.stringify({...payload,statements:[payload.statements[1]]}),{headers:{'content-type':'application/json'}})});
 await assert.rejects(onlyDemo.load('label_0001','statement_001'),/^Error: Statement unavailable$/);
});
test('same-revision document changes fail and unchanged retries remain valid',async()=>{
 let hash='a'.repeat(64),revision=2;
 const client=createTooLostClient({now:()=>2000,fetchImpl:async()=>new Response(JSON.stringify({labelId:'label_0001',statements:[{...statement('label_0001',revision),source:{...statement('label_0001',revision).source,documentSha256:hash}}]}),{headers:{'content-type':'application/json'}})});
 await client.load('label_0001','statement_001');await client.load('label_0001','statement_001');hash='b'.repeat(64);
 await assert.rejects(client.load('label_0001','statement_001'),/Stale statement revision/);
 revision=3;assert.equal((await client.load('label_0001','statement_001')).source.documentSha256,hash);
});
test('all statements must match the authorized label and duplicate identities are rejected',async()=>{
 for(const statements of [[statement('label_0001'),statement('label_0001')],
  [statement('label_0001'),{...statement('label_0002'),statementId:'statement_002'}]]){
  const client=createTooLostClient({now:()=>2000,fetchImpl:async()=>new Response(JSON.stringify({labelId:'label_0001',statements}),{headers:{'content-type':'application/json'}})});
  await assert.rejects(client.load('label_0001','statement_001'),/^Error: Statement unavailable$/);
 }
});
test('stream limits, deadlines and private provider errors expose only fixed errors',async()=>{
 let cancelled=false;
 const oversized=createTooLostClient({fetchImpl:async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(200001));},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}})});
 await assert.rejects(oversized.load('label_0001','statement_001'),/^Error: Statement unavailable$/);assert.equal(cancelled,true);
 const stalled=createTooLostClient({timeoutMs:20,fetchImpl:async()=>new Response(new ReadableStream(),{headers:{'content-type':'application/json'}})});
 await assert.rejects(stalled.load('label_0001','statement_001'),/timed out/);
 const error=createTooLostClient({fetchImpl:async()=>{throw new Error('private provider key');}});
 await assert.rejects(error.load('label_0001','statement_001'),/^Error: Statement unavailable$/);
});
