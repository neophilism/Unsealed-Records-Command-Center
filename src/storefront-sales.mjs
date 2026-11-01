const id=/^[A-Za-z0-9_-]{8,128}$/;
const validId=value=>typeof value==='string'&&id.test(value);
const slug=/^[a-z0-9_-]{2,64}$/;
const money=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid sales event');};
const kinds=new Set(['sale','discount','refund','fee']);
const settlements=new Set(['pending','settled']);
/** Normalized event projection; upstream authentication remains a BFF responsibility. */
export function projectSalesEvent(row,{requestedLabelId,expectedSource,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||typeof expectedSource!=='string'||!expectedSource||
  !row||typeof row!=='object'||Array.isArray(row)||row.labelId!==requestedLabelId||
  !validId(row.eventId)||!validId(row.orderId)||typeof row.storefront!=='string'||!slug.test(row.storefront)||
  typeof row.country!=='string'||!/^[A-Z]{2}$/.test(row.country)||typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency)||
  typeof row.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)||!kinds.has(row.kind)||
  !settlements.has(row.settlement)||typeof row.amountMinor!=='string'||
  !money.test(row.amountMinor)||row.amountMinor.length>100||
  !row.source||row.source.system!==expectedSource||!['live','synthetic'].includes(row.source.kind)||!Number.isSafeInteger(row.source.revision)||
  row.source.revision<0||!Number.isSafeInteger(row.source.observedAtMs)||
  row.source.observedAtMs<0||!Number.isSafeInteger(nowMs)||nowMs<0||row.source.observedAtMs>nowMs+30000) return fail();
 return Object.freeze({labelId:row.labelId,eventId:row.eventId,orderId:row.orderId,storefront:row.storefront,
  country:row.country,currency:row.currency,period:row.period,kind:row.kind,settlement:row.settlement,
  amountMinor:row.amountMinor,source:Object.freeze({system:row.source.system,kind:row.source.kind,revision:row.source.revision,observedAtMs:row.source.observedAtMs})});
}

export function summarizeSalesEvents(rows,{requestedLabelId,expectedSource,nowMs=Date.now(),period,country,storefront}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||typeof expectedSource!=='string'||!expectedSource||
   !Number.isSafeInteger(nowMs)||nowMs<0||!Array.isArray(rows)||rows.length>10000||
   (period!==undefined&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))||
   (country!==undefined&&!/^[A-Z]{2}$/.test(country))||
   (storefront!==undefined&&!slug.test(storefront))) return fail();
 const latest=new Map();
 for(const raw of rows){
  const event=projectSalesEvent(raw,{requestedLabelId,expectedSource,nowMs});
  const previous=latest.get(JSON.stringify([event.source.kind,event.eventId]));
  if(previous&&JSON.stringify([event.orderId,event.currency,event.storefront,event.country,event.kind])!==
   JSON.stringify([previous.orderId,previous.currency,previous.storefront,previous.country,previous.kind])) return fail();
  if(previous&&event.source.revision===previous.source.revision&&JSON.stringify(event)!==JSON.stringify(previous)) return fail();
  if(!previous||event.source.revision>previous.source.revision) latest.set(JSON.stringify([event.source.kind,event.eventId]),event);
 }
 const events=[...latest.values()];
 const orders=new Map();
 const orderDimensions=new Map();
 for(const event of events){
  const dimensions=JSON.stringify([event.currency,event.storefront,event.country]);
  const orderKey=JSON.stringify([event.source.kind,event.orderId]);
  if(orderDimensions.has(orderKey)&&orderDimensions.get(orderKey)!==dimensions) return fail();
  orderDimensions.set(orderKey,dimensions);
  const key=JSON.stringify([event.source.kind,event.orderId,event.currency]);
  const totals=orders.get(key)||{sale:0n,discount:0n,refund:0n,saleCount:0};
  if(event.kind==='sale') totals.saleCount++;
  if(['sale','discount','refund'].includes(event.kind)) totals[event.kind]+=BigInt(event.amountMinor);
  orders.set(key,totals);
 }
 for(const totals of orders.values()) if(totals.saleCount===0||totals.discount+totals.refund>totals.sale) return fail();
 const selected=events.filter(e=>(period===undefined||e.period===period)&&
  (country===undefined||e.country===country)&&(storefront===undefined||e.storefront===storefront));
 const byCurrency=new Map();
 for(const event of selected){
  const currencyKey=JSON.stringify([event.source.kind,event.currency]);
  const totals=byCurrency.get(currencyKey)||{gross:0n,discounts:0n,refunds:0n,fees:0n,pendingNet:0n,settledNet:0n,orders:new Set(),currency:event.currency,sourceKind:event.source.kind};
  const amount=BigInt(event.amountMinor),signed=event.kind==='sale'?amount:-amount;
  if(event.kind==='sale'){totals.gross+=amount;totals.orders.add(event.orderId);}
  if(event.kind==='discount') totals.discounts+=amount;
  if(event.kind==='refund') totals.refunds+=amount;
  if(event.kind==='fee') totals.fees+=amount;
  totals[event.settlement==='settled'?'settledNet':'pendingNet']+=signed;
  byCurrency.set(currencyKey,totals);
 }
 const availability=selected.length===0?'awaiting':selected.every(x=>x.source.kind==='synthetic')?'synthetic':
  selected.some(x=>x.source.kind==='synthetic')?'mixed':'observed';
 const currencies=Object.freeze([...byCurrency.values()].sort((a,b)=>a.currency.localeCompare(b.currency)||a.sourceKind.localeCompare(b.sourceKind)).map(t=>Object.freeze({
    currency:t.currency,sourceKind:t.sourceKind,orderCount:t.orders.size.toString(),grossMinor:t.gross.toString(),discountMinor:t.discounts.toString(),
    refundMinor:t.refunds.toString(),feeMinor:t.fees.toString(),settledNetMinor:t.settledNet.toString(),pendingNetMinor:t.pendingNet.toString()})));
 return Object.freeze({labelId:requestedLabelId,availability,
  currencies:availability==='mixed'?Object.freeze([]):currencies,
  sourceSummaries:Object.freeze(['live','synthetic'].map(kind=>{
   const sourceEvents=selected.filter(e=>e.source.kind===kind),times=sourceEvents.map(e=>e.source.observedAtMs);
   return Object.freeze({kind,currencies:Object.freeze(currencies.filter(c=>c.sourceKind===kind)),
    source:sourceEvents.length?Object.freeze({system:expectedSource,observedFromMs:Math.min(...times),observedToMs:Math.max(...times),eventCount:sourceEvents.length.toString()}):null});
  }))});
}

export function projectStorefrontSale(row){
 if(!row||row.labelAuthorized!==true||row.sourceVerified!==true||typeof row.labelId!=='string'||row.labelId.length<8||
   typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency)||typeof row.amountMinor!=='string'||
   !money.test(row.amountMinor)||typeof row.orderCount!=='string'||!money.test(row.orderCount)||
   typeof row.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) return fail();
 return Object.freeze({labelId:row.labelId,currency:row.currency,amountMinor:row.amountMinor,orderCount:row.orderCount,period:row.period});
}
