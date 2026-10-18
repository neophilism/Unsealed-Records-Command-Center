import test from 'node:test';import assert from 'node:assert/strict';
import {createSalesClient} from './sales-client.mjs';
const event=(label,revision=1)=>({labelId:label,eventId:'event_0001',orderId:'order_0001',storefront:'bandcamp',country:'US',currency:'USD',period:'2026-10',kind:'sale',settlement:'settled',amountMinor:'20',source:{system:'engine',kind:'live',revision,observedAtMs:1000}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,events:[event(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin sales request carries no provider credential',async()=>{
 const client=createSalesClient({expectedSource:'engine',now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/sales');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.authorization,undefined);return json('label_0001',1);
 }});
 assert.equal((await client.load('label_0001')).currencies[0].settledNetMinor,'20');
});
test('scope switch discards earlier result and wrong label fails',async()=>{
 let release;
 const client=createSalesClient({expectedSource:'engine',now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).labelId,'label_0002');
 release();await assert.rejects(old,/superseded/);
 const wrong=createSalesClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>json('label_0002',1)});
 await assert.rejects(()=>wrong.load('label_0001'));
});
test('older source revision is rejected across requests',async()=>{
 let revision=2;
 const client=createSalesClient({expectedSource:'engine',now:()=>2000,fetchImpl:async()=>json('label_0001',revision)});
 await client.load('label_0001');revision=1;await assert.rejects(()=>client.load('label_0001'),/Stale sales event/);
});
