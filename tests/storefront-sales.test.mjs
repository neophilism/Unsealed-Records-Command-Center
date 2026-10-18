import test from 'node:test';import assert from 'node:assert/strict';
import {projectSalesEvent,summarizeSalesEvents,projectStorefrontSale} from './sales.mjs';
const base={labelId:'label_0001',eventId:'event_0001',orderId:'order_0001',storefront:'bandcamp',country:'US',currency:'USD',period:'2026-10',kind:'sale',settlement:'settled',amountMinor:'9007199254740993',source:{system:'engine',kind:'live',revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',expectedSource:'engine',nowMs:2000};
const event=(eventId,kind,amountMinor,settlement='settled')=>({...base,eventId,kind,amountMinor,settlement});
test('exact per-currency gross, discounts, refunds, fees and settlement totals',()=>{
 const rows=[base,event('event_0002','discount','3'),event('event_0003','refund','5'),event('event_0004','fee','2'),
  {...event('event_0005','sale','10','pending'),orderId:'order_0002',country:'GB'}];
 const result=summarizeSalesEvents(rows,options);const usd=result.currencies[0];
 assert.equal(usd.grossMinor,'9007199254741003');assert.equal(usd.discountMinor,'3');
 assert.equal(usd.refundMinor,'5');assert.equal(usd.feeMinor,'2');
 assert.equal(usd.settledNetMinor,'9007199254740983');assert.equal(usd.pendingNetMinor,'10');
 assert.equal(usd.orderCount,'2');
 const us=summarizeSalesEvents(rows,{...options,country:'US'});assert.equal(us.currencies[0].grossMinor,base.amountMinor);
});
test('newest event revision wins and contradictory same-revision event fails',()=>{
 const corrected={...base,amountMinor:'7',source:{...base.source,revision:2}};
 assert.equal(summarizeSalesEvents([base,corrected],options).currencies[0].grossMinor,'7');
 assert.throws(()=>summarizeSalesEvents([base,{...base,amountMinor:'7'}],options));
});
test('wrong label, malformed money, unsupported source and over-refund fail',()=>{
 for(const row of [{...base,labelId:'label_0002'},{...base,amountMinor:'1.00'},
  {...base,source:{...base.source,system:'unknown'}}]) assert.throws(()=>projectSalesEvent(row,options));
 assert.throws(()=>summarizeSalesEvents([base,event('event_0002','refund','9007199254740994')],options));
 assert.throws(()=>summarizeSalesEvents([event('event_0002','refund','1')],options));
 assert.throws(()=>summarizeSalesEvents([base,{...event('event_0002','fee','1'),storefront:'other'}],options));
});
test('empty selection is awaiting, not zero revenue',()=>{
 const result=summarizeSalesEvents([base],{...options,country:'GB'});
 assert.equal(result.availability,'awaiting');assert.deepEqual(result.currencies,[]);
});
test('synthetic sales stay explicitly synthetic',()=>{
 const synthetic={...base,source:{...base.source,kind:'synthetic'}};
 assert.equal(summarizeSalesEvents([synthetic],options).availability,'synthetic');
});
test('legacy minor-unit projection remains compatible',()=>{
 const row={labelAuthorized:true,sourceVerified:true,labelId:'label_0001',currency:'USD',amountMinor:'9007199254740993',orderCount:'2',period:'2026-10'};
 assert.equal(projectStorefrontSale(row).amountMinor,row.amountMinor);
});
