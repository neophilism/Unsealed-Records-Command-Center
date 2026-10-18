import test from 'node:test';import assert from 'node:assert/strict';
import {createSceneSignalClient} from './scenesignal-client.mjs';
const session=(label,revision=1)=>({labelId:label,sessionId:'session_0001',eventId:'event_0001',startedAt:'2026-10-18T20:00:00Z',status:'running',attendance:'5',engagements:'3',commerceTransactions:'1',commerceMinor:'100',currency:'USD',source:{system:'SceneSignal',kind:'live',revision,observedAtMs:1000}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,sessions:[session(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin session client suppresses small groups',async()=>{
 const client=createSceneSignalClient({now:()=>2000,fetchImpl:async(url,opts)=>{
  assert.equal(url,'/api/labels/label_0001/reports/scenesignal');assert.equal(opts.credentials,'same-origin');return json('label_0001',1);
 }});
 const result=await client.load('label_0001');assert.equal(result.sessions[0].attendance,null);assert.equal(result.sessions[0].commerceMinor,null);
});
test('wrong label and superseded scope are rejected',async()=>{
 const wrong=createSceneSignalClient({now:()=>2000,fetchImpl:async()=>json('label_0002',1)});
 await assert.rejects(()=>wrong.load('label_0001'));
 let release;const client=createSceneSignalClient({now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).labelId,'label_0002');
 release();await assert.rejects(old,/superseded/);
});
