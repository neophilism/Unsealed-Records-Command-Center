const id=/^[A-Za-z0-9_-]{8,128}$/;
const units=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid TrackZero event');};
/** Read-only projection of a source-verified, per-artist contributor event. */
export function projectTrackZeroEvent(x,{requestedLabelId,requestedCreatorId,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||
   typeof requestedCreatorId!=='string'||!id.test(requestedCreatorId)||
   !x||typeof x!=='object'||Array.isArray(x)||x.labelId!==requestedLabelId||
   x.creatorId!==requestedCreatorId||!id.test(x.artistId||'')||!id.test(x.occurrenceId||'')||
   !id.test(x.eventId||'')||!['earned','spent'].includes(x.action)||
   typeof x.pointsMicro!=='string'||!units.test(x.pointsMicro)||x.pointsMicro.length>100||
   x.verified!==true||x.evidenceVerified!==true||
   (x.action==='earned'&&(x.eligiblePlayback!==true||x.finalAnnouncementCompleted!==true))||
   (x.action==='spent'&&x.redemptionConfirmed!==true)||
   !x.source||x.source.system!=='TrackZero'||!['live','synthetic'].includes(x.source.kind)||
   !Number.isSafeInteger(x.source.revision)||x.source.revision<0||
   !Number.isSafeInteger(x.source.observedAtMs)||x.source.observedAtMs<0||
   !Number.isSafeInteger(nowMs)||x.source.observedAtMs>nowMs+30000) return fail();
 return Object.freeze({labelId:x.labelId,creatorId:x.creatorId,artistId:x.artistId,
  occurrenceId:x.occurrenceId,eventId:x.eventId,action:x.action,pointsMicro:x.pointsMicro,
  source:Object.freeze({...x.source})});
}

/** Separate exact point balances by artist; never pool artist allocations. */
export function summarizeTrackZeroEvents(events,{requestedLabelId,requestedCreatorId,nowMs=Date.now()}={}){
 if(!Array.isArray(events)||events.length>10000) return fail();
 const latest=new Map();
 for(const raw of events){
  const event=projectTrackZeroEvent(raw,{requestedLabelId,requestedCreatorId,nowMs});
  const previous=latest.get(event.eventId);
  if(previous&&event.source.revision===previous.source.revision&&JSON.stringify(event)!==JSON.stringify(previous)) return fail();
  if(!previous||event.source.revision>previous.source.revision) latest.set(event.eventId,event);
 }
 const seenOccurrence=new Set(),artists=new Map();
 for(const event of latest.values()){
  if(event.action==='earned'){
   const key=JSON.stringify([event.creatorId,event.artistId,event.occurrenceId]);
   if(seenOccurrence.has(key)) return fail();seenOccurrence.add(key);
  }
  const totals=artists.get(event.artistId)||{earned:0n,spent:0n,kinds:new Set()};
  totals[event.action]+=BigInt(event.pointsMicro);totals.kinds.add(event.source.kind);
  artists.set(event.artistId,totals);
 }
 return Object.freeze({labelId:requestedLabelId,creatorId:requestedCreatorId,
  artists:Object.freeze([...artists].sort(([a],[b])=>a.localeCompare(b)).map(([artistId,t])=>Object.freeze({
    artistId,earnedMicro:t.earned.toString(),spentMicro:t.spent.toString(),
    sourceState:t.kinds.size>1?'mixed':t.kinds.has('synthetic')?'synthetic':'observed'})))});
}

/** Legacy vested-only projection. */
export function projectContribution(x){
 if(!x||x.verified!==true||x.labelAuthorized!==true||typeof x.creatorId!=='string'||x.creatorId.length<8||
  typeof x.occurrenceId!=='string'||x.occurrenceId.length<8||typeof x.pointsMicro!=='string'||
  !units.test(x.pointsMicro)||x.finalAnnouncementCompleted!==true||x.eligiblePlayback!==true||
  x.evidenceVerified!==true) return fail();
 return Object.freeze({creatorId:x.creatorId,occurrenceId:x.occurrenceId,pointsMicro:x.pointsMicro});
}
