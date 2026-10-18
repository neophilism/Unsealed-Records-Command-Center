const label=/^[A-Za-z0-9_-]{8,128}$/;
const platform=/^[a-z0-9_-]{2,64}$/;
const count=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid streaming snapshot');};
function validPeriod(value){
 if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
 return true;
}
/** Validates source-bound snapshots; authentication stays in the BFF. */
export function projectStreamingRecord(x,{requestedLabelId,expectedSource,nowMs=Date.now(),freshnessMs=86400000}={}){
 if(typeof requestedLabelId!=='string'||!label.test(requestedLabelId)||
    typeof expectedSource!=='string'||expectedSource.length<1||
    !x||typeof x!=='object'||Array.isArray(x)||x.labelId!==requestedLabelId||
    !validPeriod(x.period)||typeof x.country!=='string'||!/^([A-Z]{2}|ALL)$/.test(x.country)||
    typeof x.platform!=='string'||!platform.test(x.platform)||
    typeof x.streams!=='string'||!count.test(x.streams)||x.streams.length>100||
    !x.source||x.source.system!==expectedSource||!['live','synthetic'].includes(x.source.kind)||
    !Number.isSafeInteger(x.source.revision)||x.source.revision<0||
    !Number.isSafeInteger(x.source.observedAtMs)||x.source.observedAtMs<0||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(freshnessMs)||freshnessMs<0||
    x.source.observedAtMs>nowMs+30000) return fail();
 const ageMs=Math.max(0,nowMs-x.source.observedAtMs);
 const state=x.source.kind==='synthetic'?'synthetic':ageMs>freshnessMs?'cached':'live';
 return Object.freeze({labelId:x.labelId,period:x.period,country:x.country,platform:x.platform,
  streams:x.streams,state,ageMs,source:Object.freeze({system:x.source.system,kind:x.source.kind,revision:x.source.revision,observedAtMs:x.source.observedAtMs})});
}

/** Select latest source revisions, preserving exact integer counts. */
export function selectStreamingRecords(records,{requestedLabelId,period,country,platform:platformFilter,expectedSource,nowMs=Date.now(),freshnessMs=86400000}={}){
 if(!Array.isArray(records)||records.length>10000||
   (period!==undefined&&!validPeriod(period))||
   (country!==undefined&&!/^([A-Z]{2}|ALL)$/.test(country))||
   (platformFilter!==undefined&&!platform.test(platformFilter))) return fail();
 const latest=new Map();
 for(const raw of records){
  const record=projectStreamingRecord(raw,{requestedLabelId,expectedSource,nowMs,freshnessMs});
  const key=JSON.stringify([record.period,record.country,record.platform]);
  const previous=latest.get(key);
  if(previous&&record.source.revision===previous.source.revision&&JSON.stringify(record)!==JSON.stringify(previous)) return fail();
  if(!previous||record.source.revision>previous.source.revision) latest.set(key,record);
 }
 const selected=[...latest.values()].filter(x=>(period===undefined||x.period===period)&&
  (country===undefined||x.country===country)&&(platformFilter===undefined||x.platform===platformFilter));
 selected.sort((a,b)=>a.period.localeCompare(b.period)||a.country.localeCompare(b.country)||a.platform.localeCompare(b.platform));
 const total=selected.reduce((sum,x)=>sum+BigInt(x.streams),0n).toString();
 return Object.freeze({labelId:requestedLabelId,totalStreams:total,records:Object.freeze(selected)});
}

/** Legacy narrow projection retained for existing draft consumers. */
export function projectStreamingSnapshot(x){
 if(!x||x.authorized!==true||x.sourceVerified!==true||typeof x.labelId!=='string'||x.labelId.length<8||
   typeof x.period!=='string'||!validPeriod(x.period)||typeof x.streams!=='string'||!count.test(x.streams)||
   typeof x.observedAt!=='string'||!Number.isFinite(Date.parse(x.observedAt))) return fail();
 return Object.freeze({labelId:x.labelId,period:x.period,streams:x.streams,source:x.source??'unknown',observedAt:x.observedAt,stale:x.stale!==false});
}
