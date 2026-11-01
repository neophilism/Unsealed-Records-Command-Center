import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMinorAmount,renderSales} from '../src/sales-view.mjs';
import {summarizeSalesEvents} from '../src/storefront-sales.mjs';
const base={labelId:'label_0001',eventId:'event_0001',orderId:'order_0001',storefront:'bandcamp',country:'US',currency:'USD',period:'2026-10',kind:'sale',settlement:'settled',amountMinor:'9007199254740993',source:{system:'engine',kind:'live',revision:1,observedAtMs:1000}};
const policy={requestedLabelId:'label_0001',expectedSource:'engine',nowMs:2000};
test('currency amounts retain exact digits without assuming two decimal places',()=>{
 assert.equal(formatMinorAmount('9007199254740993',2),'90,071,992,547,409.93');
 assert.equal(formatMinorAmount('1234',0),'1,234');assert.equal(formatMinorAmount('-1234',3),'-1.234');
 assert.equal(formatMinorAmount('0',2),'0.00');assert.throws(()=>formatMinorAmount('1e3',2));
 assert.throws(()=>formatMinorAmount('100',NaN));assert.throws(()=>formatMinorAmount('100',9));
});
test('sales view keeps settlement categories and exact currency scale explicit',()=>{
 const summary=summarizeSalesEvents([base],policy),html=renderSales(summary,{requestedLabelId:'label_0001',currencyDigits:{USD:2}});
 assert.match(html,/90,071,992,547,409.93/);assert.match(html,/Settled net/);assert.match(html,/Pending net/);assert.match(html,/<caption>/);
 assert.match(renderSales(summary,{requestedLabelId:'label_0001'}),/Unavailable/);
 assert.throws(()=>renderSales(summary,{requestedLabelId:'label_0002',currencyDigits:{USD:2}}));
});
test('synthetic and observed sales render in separate sections with no combined total',()=>{
 const summary=summarizeSalesEvents([base,{...base,amountMinor:'100',source:{...base.source,kind:'synthetic'}}],policy);
 const html=renderSales(summary,{requestedLabelId:'label_0001',currencyDigits:{USD:2}});
 assert.match(html,/no combined total/);assert.match(html,/Observed transactions/);assert.match(html,/Synthetic demo/);
 assert.match(renderSales(summarizeSalesEvents([],policy),{requestedLabelId:'label_0001'}),/Awaiting sales data/);
});
