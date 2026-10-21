import test from 'node:test';import assert from 'node:assert/strict';
import {createEventClient} from './event-client.mjs';
const event=(label,revision=1)=>({labelId:label,ownerVerified:true,publishApproved:true,eventId:'event_0001',title:'Street launch',startsAt:'2026-10-19T10:00:00Z',endsAt:'2026-10-19T12:00:00Z',status:'scheduled',publicUrl:'https://events.example/e/1',source:{revision,observedAtMs:1000}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,events:[event(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin calendar reader has no provider credential',async()=>{
 const client=createEventClient({allowedHosts:['events.example'],now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/events');assert.equal(options.credentials,'same-origin');assert.equal(options.headers.authorization,undefined);return json('label_0001',1);
 }});
 assert.equal((await client.load('label_0001')).events[0].title,'Street launch');
});
test('wrong label and old in-flight response are rejected',async()=>{
 const wrong=createEventClient({allowedHosts:['events.example'],now:()=>2000,fetchImpl:async()=>json('label_0002',1)});
 await assert.rejects(()=>wrong.load('label_0001'));
 let release;const client=createEventClient({allowedHosts:['events.example'],now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).labelId,'label_0002');release();await assert.rejects(old,/superseded/);
});
