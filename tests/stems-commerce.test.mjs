import test from 'node:test';import assert from 'node:assert/strict';
import {projectStemsReceipt,createStemsReceiptGuard,projectStemsProduct} from './stems.mjs';
const base={provider:'Stems White Label',labelId:'label_0001',orderId:'order_0001',productId:'product_001',eventId:'event_0001',currency:'USD',status:'paid',licenseType:'commercial',licenseId:'license_001',entitlementStatus:'active',grossMinor:'9007199254740993',taxMinor:'3',providerFeeMinor:'2',platformFeeMinor:'1',refundMinor:'0',creatorIncomeMinor:'9007199254740987',source:{system:'Stems White Label',kind:'live',revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',nowMs:2000};
test('exact receipt breakdown and replay guard',()=>{
 const receipt=projectStemsReceipt(base,options);assert.equal(receipt.creatorIncomeMinor,'9007199254740987');
 const guard=createStemsReceiptGuard();assert.equal(guard.accept(receipt),'accepted');
 assert.equal(guard.accept(receipt),'duplicate');
 assert.equal(guard.accept({...receipt,creatorIncomeMinor:'0'}),'conflict');
 const old=projectStemsReceipt({...base,eventId:'event_0002',source:{...base.source,revision:0}},options);
 assert.equal(guard.accept(old),'stale');
});
test('cross-label, amount mismatch, revoked status and synthetic entitlement fail closed',()=>{
 const bad=[{...base,labelId:'label_0002'},
  {...base,creatorIncomeMinor:'9007199254740988'},
  {...base,status:'refunded'},
  {...base,source:{...base.source,kind:'synthetic'}}];
 for(const row of bad) assert.throws(()=>projectStemsReceipt(row,options));
});
test('refund receipt never grants active entitlement',()=>{
 const row={...base,eventId:'event_0002',status:'partially_refunded',refundMinor:'10',creatorIncomeMinor:'9007199254740977',entitlementStatus:'revoked',source:{...base.source,revision:2}};
 assert.equal(projectStemsReceipt(row,options).entitlementStatus,'revoked');
});
test('legacy offer projector remains compatible',()=>{
 const offer={provider:'Stems White Label',ownerVerified:true,catalogVerified:true,saleAuthorized:true,labelId:'label_0001',productId:'product_001',priceMinor:'999',currency:'USD'};
 assert.equal(projectStemsProduct(offer).priceMinor,'999');
});
