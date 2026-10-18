const id=/^[A-Za-z0-9_-]{8,128}$/;
const count=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid SceneSignal aggregate');};
const order={planned:0,running:1,ended:2};
/** Privacy-limited aggregate; the upstream must authenticate and obtain consent. */
export function projectSceneSignalAggregate(x,{requestedLabelId,minimumGroupSize=10,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||
  !Number.isSafeInteger(minimumGroupSize)||minimumGroupSize<2||
  !x||typeof x!=='object'||Array.isArray(x)||x.labelId!==requestedLabelId||
  !id.test(x.sessionId||'')||!id.test(x.eventId||'')||
  typeof x.startedAt!=='string'||!Number.isFinite(Date.parse(x.startedAt))||
  !Object.hasOwn(order,x.status)||x.participantIds!==undefined||x.exactLocation!==undefined||
  ![x.attendance,x.engagements,x.commerceTransactions,x.commerceMinor].every(v=>typeof v==='string'&&count.test(v)&&v.length<=100)||
  !/^[A-Z]{3}$/.test(x.currency||'')||!x.source||x.source.system!=='SceneSignal'||
  !['live','synthetic'].includes(x.source.kind)||!Number.isSafeInteger(x.source.revision)||x.source.revision<0||
  !Number.isSafeInteger(x.source.observedAtMs)||x.source.observedAtMs<0||
  !Number.isSafeInteger(nowMs)||x.source.observedAtMs>nowMs+30000) return fail();
 const visible=value=>BigInt(value)>=BigInt(minimumGroupSize)?value:null;
 const commerceVisible=visible(x.commerceTransactions)!==null;
 return Object.freeze({labelId:x.labelId,sessionId:x.sessionId,eventId:x.eventId,
  startedAt:x.startedAt,status:x.status,currency:x.currency,
  attendance:visible(x.attendance),engagements:visible(x.engagements),
  commerceTransactions:commerceVisible?x.commerceTransactions:null,
  commerceMinor:commerceVisible?x.commerceMinor:null,
  privacySuppressed:visible(x.attendance)===null||visible(x.engagements)===null||!commerceVisible,
  source:Object.freeze({...x.source})});
}

/** Reject stale versions and backwards session-state changes. */
export function createSceneSignalRevisionGuard(){
 const latest=new Map();
 return Object.freeze({accept(record){
  const key=JSON.stringify([record.labelId,record.sessionId]);const previous=latest.get(key);
  if(previous){
   if(record.source.revision<previous.source.revision) return 'stale';
   if(record.source.revision===previous.source.revision) return JSON.stringify(record)===JSON.stringify(previous)?'duplicate':'conflict';
   if(order[record.status]<order[previous.status]) return 'state_regression';
  }
  latest.set(key,record);return 'accepted';
 }});
}

/** Legacy narrow projection. */
export function projectSceneSignalSession(x){
 if(!x||x.sourceVerified!==true||x.labelAuthorized!==true||typeof x.sessionId!=='string'||x.sessionId.length<8||
  typeof x.eventId!=='string'||x.eventId.length<8||typeof x.startedAt!=='string'||
  !Number.isFinite(Date.parse(x.startedAt))||typeof x.status!=='string'||!Object.hasOwn(order,x.status)||
  x.exactLocation!==undefined||x.participantIds!==undefined) return fail();
 return Object.freeze({sessionId:x.sessionId,eventId:x.eventId,startedAt:x.startedAt,status:x.status});
}
