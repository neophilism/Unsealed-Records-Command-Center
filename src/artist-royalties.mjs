const id=/^[A-Za-z0-9_-]{8,128}$/;
const signed=/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid artist royalty statement');};
/** Reconcile full source allocations before revealing only one artist's share. */
export function projectArtistPortfolio(payload,{requestedArtistId,authorizedLabelIds,nowMs=Date.now()}={}){
 if(typeof requestedArtistId!=='string'||!id.test(requestedArtistId)||
  !Array.isArray(authorizedLabelIds)||authorizedLabelIds.some(label=>typeof label!=='string'||!id.test(label))||
  !payload||!Array.isArray(payload.statements)||payload.statements.length>10000) return fail();
 const allowed=new Set(authorizedLabelIds),seen=new Set(),items=[];
 for(const statement of payload.statements){
  if(!statement||!id.test(statement.statementId||'')||seen.has(statement.statementId)||
    !allowed.has(statement.labelId)||!id.test(statement.releaseId||'')||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(statement.period||'')||
    !/^[A-Z]{3}$/.test(statement.currency||'')||
    typeof statement.distributableMinor!=='string'||!signed.test(statement.distributableMinor)||
    !Array.isArray(statement.allocations)||statement.allocations.length<1||statement.allocations.length>100||
    !statement.source||!['live','synthetic'].includes(statement.source.kind)||
    !Number.isSafeInteger(statement.source.revision)||statement.source.revision<0||
    !Number.isSafeInteger(statement.source.observedAtMs)||statement.source.observedAtMs<0||
    !Number.isSafeInteger(nowMs)||statement.source.observedAtMs>nowMs+30000) return fail();
  seen.add(statement.statementId);
  const recipients=new Set();let total=0n,basisPoints=0,share=null;
  for(const allocation of statement.allocations){
   if(!allocation||!id.test(allocation.artistId||'')||recipients.has(allocation.artistId)||
      typeof allocation.amountMinor!=='string'||!signed.test(allocation.amountMinor)||
      !Number.isSafeInteger(allocation.splitBasisPoints)||allocation.splitBasisPoints<0||allocation.splitBasisPoints>10000) return fail();
   recipients.add(allocation.artistId);total+=BigInt(allocation.amountMinor);
   basisPoints+=allocation.splitBasisPoints;
   if(allocation.artistId===requestedArtistId) share=allocation;
  }
  if(total!==BigInt(statement.distributableMinor)||basisPoints!==10000) return fail();
  if(share) items.push(Object.freeze({statementId:statement.statementId,labelId:statement.labelId,
    releaseId:statement.releaseId,period:statement.period,currency:statement.currency,
    amountMinor:share.amountMinor,splitBasisPoints:share.splitBasisPoints,
    source:Object.freeze({kind:statement.source.kind,revision:statement.source.revision,observedAtMs:statement.source.observedAtMs})}));
 }
 return Object.freeze({artistId:requestedArtistId,statements:Object.freeze(items)});
}

/** Group one artist's projected shares; never merge currencies. */
export function summarizeArtistPortfolio(portfolio){
 const totals=new Map();
 for(const item of portfolio.statements){
  const key=JSON.stringify([item.releaseId,item.currency]);
  const value=totals.get(key)||{releaseId:item.releaseId,currency:item.currency,total:0n};
  value.total+=BigInt(item.amountMinor);totals.set(key,value);
 }
 return Object.freeze([...totals.values()].map(x=>Object.freeze({releaseId:x.releaseId,currency:x.currency,totalMinor:x.total.toString()})));
}

/** Legacy narrow projection. */
export function projectArtistRoyalty(x){
 if(!x||x.artistAuthorized!==true||x.sourceVerified!==true||typeof x.artistId!=='string'||x.artistId.length<8||
  typeof x.statementId!=='string'||x.statementId.length<8||!/^[A-Z]{3}$/.test(x.currency||'')||
  typeof x.amountMinor!=='string'||!signed.test(x.amountMinor)||
  !/^\d{4}-(0[1-9]|1[0-2])$/.test(x.period||'')) return fail();
 return Object.freeze({artistId:x.artistId,statementId:x.statementId,period:x.period,amountMinor:x.amountMinor,currency:x.currency});
}
