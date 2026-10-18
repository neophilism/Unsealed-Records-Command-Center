const id=/^[A-Za-z0-9_-]{8,128}$/;
const slug=/^[a-z0-9_-]{2,64}$/;
const money=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid sales event');};
const kinds=new Set(['sale','discount','refund','fee']);
const settlements=new Set(['pending','settled']);
/** Normalized event projection; upstream authentication remains a BFF responsibility. */
export function projectSalesEvent(row,{requestedLabelId,expectedSource,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||typeof expectedSource!=='string'||!expectedSource||
  !row||typeof row!=='object'||Array.isArray(row)||row.labelId!==requestedLabelId||
  !id.test(row.eventId||'')||!id.test(row.orderId||'')||!slug.test(row.storefront||'')||
  !/^[A-Z]{2}$/.test(row.country||'')||!/^[A-Z]{3}$/.test(row.currency||'')||
  !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period||'')||!kinds.has(row.kind)||
  !settlements.has(row.settlement)||typeof row.amountMinor!=='string'||
  !money.test(row.amountMinor)||row.amountMinor.length>100||
  !row.source||row.source.system!==expectedSource||!Number.isSafeInteger(row.source.revision)||
  row.source.revision<0||!Number.isSafeInteger(row.source.observedAtMs)||
  row.source.observedAtMs<0||!Number.isSafeInteger(nowMs)||row.source.observedAtMs>nowMs+30000) return fail();
 return Object.freeze({labelId:row.labelId,eventId:row.eventId,orderId:row.orderId,storefront:row.storefront,
  country:row.country,currency:row.currency,period:row.period,kind:row.kind,settlement:row.settlement,
  amountMinor:row.amountMinor,source:Object.freeze({system:row.source.system,revision:row.source.revision,observedAtMs:row.source.observedAtMs})});
}

export function summarizeSalesEvents(rows,{requestedLabelId,expectedSource,nowMs=Date.now(),period,country,storefront}={}){
 if(!Array.isArray(rows)||rows.length>10000||
   (period!==undefined&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))||
   (country!==undefined&&!/^[A-Z]{2}$/.test(country))||
   (storefront!==undefined&&!slug.test(storefront))) return fail();
 const latest=new Map();
 for(const raw of rows){
  const event=projectSalesEvent(raw,{requestedLabelId,expectedSource,nowMs});
  const previous=latest.get(event.eventId);
  if(previous&&event.source.revision===previous.source.revision&&JSON.stringify(event)!==JSON.stringify(previous)) return fail();
  if(!previous||event.source.revision>previous.source.revision) latest.set(event.eventId,event);
 }
 const events=[...latest.values()];
 const orders=new Map();
 const orderDimensions=new Map();
 for(const event of events){
  const dimensions=JSON.stringify([event.currency,event.storefront,event.country]);
  if(orderDimensions.has(event.orderId)&&orderDimensions.get(event.orderId)!==dimensions) return fail();
  orderDimensions.set(event.orderId,dimensions);
  const key=JSON.stringify([event.orderId,event.currency]);
  const totals=orders.get(key)||{sale:0n,discount:0n,refund:0n};
  if(event.kind in totals) totals[event.kind]+=BigInt(event.amountMinor);
  orders.set(key,totals);
 }
 for(const totals of orders.values()) if(totals.sale===0n||totals.discount+totals.refund>totals.sale) return fail();
 const selected=events.filter(e=>(period===undefined||e.period===period)&&
  (country===undefined||e.country===country)&&(storefront===undefined||e.storefront===storefront));
 const byCurrency=new Map();
 for(const event of selected){
  const totals=byCurrency.get(event.currency)||{gross:0n,discounts:0n,refunds:0n,fees:0n,pendingNet:0n,settledNet:0n,orders:new Set()};
  const amount=BigInt(event.amountMinor),signed=event.kind==='sale'?amount:-amount;
  if(event.kind==='sale'){totals.gross+=amount;totals.orders.add(event.orderId);}
  if(event.kind==='discount') totals.discounts+=amount;
  if(event.kind==='refund') totals.refunds+=amount;
  if(event.kind==='fee') totals.fees+=amount;
  totals[event.settlement==='settled'?'settledNet':'pendingNet']+=signed;
  byCurrency.set(event.currency,totals);
 }
 return Object.freeze({labelId:requestedLabelId,availability:selected.length?'observed':'awaiting',
  currencies:Object.freeze([...byCurrency].sort(([a],[b])=>a.localeCompare(b)).map(([currency,t])=>Object.freeze({
    currency,orderCount:t.orders.size.toString(),grossMinor:t.gross.toString(),discountMinor:t.discounts.toString(),
    refundMinor:t.refunds.toString(),feeMinor:t.fees.toString(),
    settledNetMinor:t.settledNet.toString(),pendingNetMinor:t.pendingNet.toString()})))});
}

export function projectStorefrontSale(row){
 if(!row||row.labelAuthorized!==true||row.sourceVerified!==true||typeof row.labelId!=='string'||row.labelId.length<8||
   typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency)||typeof row.amountMinor!=='string'||
   !money.test(row.amountMinor)||typeof row.orderCount!=='string'||!money.test(row.orderCount)||
   typeof row.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) return fail();
 return Object.freeze({labelId:row.labelId,currency:row.currency,amountMinor:row.amountMinor,orderCount:row.orderCount,period:row.period});
}
