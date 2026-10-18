import test from 'node:test';import assert from 'node:assert/strict';
import {createStemsClient} from './stems-client.mjs';
const receipt=(label,revision=1)=>({provider:'Stems White Label',labelId:label,orderId:'order_0001',productId:'product_001',eventId:'event_0001',currency:'USD',status:'paid',licenseType:'commercial',licenseId:'license_001',entitlementStatus:'active',grossMinor:'100',taxMinor:'5',providerFeeMinor:'3',platformFeeMinor:'2',refundMinor:'0',creatorIncomeMinor:'90',source:{system:'Stems White Label',kind:'live',revision,observedAtMs:1000}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,receipts:[receipt(label,revision)]}),{headers:{'content-type':'application/json'}});
test('read-only same-origin receipt without provider key',async()=>{
 const client=createStemsClient({now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/stems');assert.equal(options.method,'GET');
  assert.equal(options.credentials,'same-origin');assert.equal(options.headers.authorization,undefined);return json('label_0001',1);
 }});
 assert.equal((await client.load('label_0001','order_0001')).creatorIncomeMinor,'90');
});
test('wrong label and old in-flight scope are denied',async()=>{
 const wrong=createStemsClient({now:()=>2000,fetchImpl:async()=>json('label_0002',1)});
 await assert.rejects(()=>wrong.load('label_0001','order_0001'));
 let release;
 const client=createStemsClient({now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001','order_0001');assert.equal((await client.load('label_0002','order_0001')).labelId,'label_0002');
 release();await assert.rejects(old,/superseded/);
});
