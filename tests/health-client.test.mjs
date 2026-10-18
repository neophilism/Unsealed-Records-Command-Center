import test from 'node:test';import assert from 'node:assert/strict';
import {createSourceHealthClient} from './health-client.mjs';
const observation=label=>({labelId:label,sourceId:'streaming',metricId:'streams',accessVerified:true,kind:'live',valueDecimal:'100',revision:1,observedAtMs:1000,maxAgeMs:10000});
const json=label=>new Response(JSON.stringify({labelId:label,observations:[observation(label)]}),{headers:{'content-type':'application/json'}});
test('same-origin source health never passes provider credentials',async()=>{
 const client=createSourceHealthClient({baselineByMetric:{streams:'100'},now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/health');assert.equal(options.credentials,'same-origin');assert.equal(options.headers.authorization,undefined);return json('label_0001');
 }});
 assert.equal((await client.load('label_0001')).decisions[0].status,'current');
});
test('wrong label and old scope are rejected',async()=>{
 const wrong=createSourceHealthClient({baselineByMetric:{streams:'100'},now:()=>2000,fetchImpl:async()=>json('label_0002')});
 await assert.rejects(()=>wrong.load('label_0001'));
 let release;const client=createSourceHealthClient({baselineByMetric:{streams:'100'},now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001'));}):json('label_0002')});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).labelId,'label_0002');release();await assert.rejects(old,/superseded/);
});
