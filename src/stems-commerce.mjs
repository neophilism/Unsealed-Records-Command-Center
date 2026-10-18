const id=/^[A-Za-z0-9_-]{8,128}$/;
const money=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid Stems record');};
const validMoney=value=>typeof value==='string'&&money.test(value)&&value.length<=100;
/** Read-only receipt projection. It never authorizes a purchase or download. */
export function projectStemsReceipt(row,{requestedLabelId,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||!row||typeof row!=='object'||Array.isArray(row)||
   row.provider!=='Stems White Label'||row.labelId!==requestedLabelId||
   !id.test(row.orderId||'')||!id.test(row.productId||'')||!id.test(row.eventId||'')||
   !/^[A-Z]{3}$/.test(row.currency||'')||!['paid','partially_refunded','refunded'].includes(row.status)||
   !['commercial','personal'].includes(row.licenseType)||!id.test(row.licenseId||'')||
   !['active','revoked','pending'].includes(row.entitlementStatus)||
   ![row.grossMinor,row.taxMinor,row.providerFeeMinor,row.platformFeeMinor,row.refundMinor,row.creatorIncomeMinor].every(validMoney)||
   !row.source||row.source.system!=='Stems White Label'||!['live','synthetic'].includes(row.source.kind)||
   !Number.isSafeInteger(row.source.revision)||row.source.revision<0||
   !Number.isSafeInteger(row.source.observedAtMs)||row.source.observedAtMs<0||
   !Number.isSafeInteger(nowMs)||row.source.observedAtMs>nowMs+30000) return fail();
 const gross=BigInt(row.grossMinor),tax=BigInt(row.taxMinor),providerFee=BigInt(row.providerFeeMinor),
  platformFee=BigInt(row.platformFeeMinor),refund=BigInt(row.refundMinor),income=BigInt(row.creatorIncomeMinor);
 if(tax+providerFee+platformFee+refund>gross||gross-tax-providerFee-platformFee-refund!==income||
   (row.status==='paid'&&refund!==0n)||
   (row.status==='refunded'&&refund===0n)||
   (row.entitlementStatus==='active'&&(row.status!=='paid'||row.source.kind!=='live'))) return fail();
 return Object.freeze({labelId:row.labelId,orderId:row.orderId,productId:row.productId,eventId:row.eventId,
  currency:row.currency,status:row.status,licenseType:row.licenseType,licenseId:row.licenseId,
  entitlementStatus:row.entitlementStatus,grossMinor:row.grossMinor,taxMinor:row.taxMinor,
  providerFeeMinor:row.providerFeeMinor,platformFeeMinor:row.platformFeeMinor,refundMinor:row.refundMinor,
  creatorIncomeMinor:row.creatorIncomeMinor,source:Object.freeze({...row.source})});
}

/** Reject replayed conflicting events and source revision regression. */
export function createStemsReceiptGuard(){
 const events=new Map(),orders=new Map();
 return Object.freeze({accept(receipt){
  const eventKey=JSON.stringify([receipt.labelId,receipt.eventId]);
  const fingerprint=JSON.stringify(receipt);
  if(events.has(eventKey)) return events.get(eventKey)===fingerprint?'duplicate':'conflict';
  const orderKey=JSON.stringify([receipt.labelId,receipt.orderId]);
  const previous=orders.get(orderKey);
  if(previous!==undefined&&receipt.source.revision<=previous) return 'stale';
  events.set(eventKey,fingerprint);orders.set(orderKey,receipt.source.revision);return 'accepted';
 }});
}

/** Legacy offer projection; a caller flag is not proof of live rights. */
export function projectStemsProduct(x){
 if(!x||x.provider!=='Stems White Label'||x.ownerVerified!==true||x.catalogVerified!==true||
  x.saleAuthorized!==true||typeof x.labelId!=='string'||x.labelId.length<8||
  !id.test(x.productId||'')||!validMoney(x.priceMinor)||!/^[A-Z]{3}$/.test(x.currency||'')) return fail();
 return Object.freeze({labelId:x.labelId,productId:x.productId,priceMinor:x.priceMinor,currency:x.currency});
}
