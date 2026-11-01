const id=/^[A-Za-z0-9_-]{8,128}$/;
const validId=value=>typeof value==='string'&&id.test(value);
const isrc=/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
const text=(v,max=300)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\u0000-\u001f]/.test(v);
const fail=()=>{throw new Error('Invalid catalog record');};
/** Schema projection; the caller must authenticate the upstream source and user. */
export function projectLabelCatalog(payload,{requestedLabelId,expectedSource,artworkHosts=[],nowMs=Date.now()}={}){
 if(!validId(requestedLabelId)||!text(expectedSource,100)||
    !Number.isSafeInteger(nowMs)||nowMs<0||!payload||typeof payload!=='object'||Array.isArray(payload)||
    payload.labelId!==requestedLabelId||!validId(payload.releaseId)||!text(payload.title)||
    typeof payload.releaseDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(payload.releaseDate)||
    Number.isNaN(Date.parse(payload.releaseDate+'T00:00:00Z'))||
    new Date(payload.releaseDate+'T00:00:00Z').toISOString().slice(0,10)!==payload.releaseDate||
    !Array.isArray(payload.works)||payload.works.length<1||payload.works.length>500||
    !Array.isArray(payload.tracks)||payload.tracks.length<1||payload.tracks.length>500||
    !payload.source||payload.source.system!==expectedSource||!['live','cached','synthetic'].includes(payload.source.status)||!Number.isSafeInteger(payload.source.revision)||
    payload.source.revision<0||!Number.isSafeInteger(payload.source.observedAtMs)||
    payload.source.observedAtMs>nowMs+30000||payload.source.observedAtMs<0) return fail();
 const workIds=new Set();
 const works=payload.works.map(work=>{
  if(!work||(work.labelId!==undefined&&work.labelId!==requestedLabelId)||!validId(work.workId)||workIds.has(work.workId)||!text(work.title)) return fail();
  workIds.add(work.workId);return Object.freeze({workId:work.workId,title:work.title.trim()});
 });
 const seen=new Set();
 const tracks=payload.tracks.map(track=>{
  if(!track||(track.labelId!==undefined&&track.labelId!==requestedLabelId)||!validId(track.trackId)||seen.has(track.trackId)||!text(track.title)||
     typeof track.isrc!=='string'||!isrc.test(track.isrc)||!Array.isArray(track.workIds)||
     track.workIds.length<1||track.workIds.length>50||new Set(track.workIds).size!==track.workIds.length||
     track.workIds.some(workId=>!workIds.has(workId))) return fail();
  seen.add(track.trackId);
  return Object.freeze({trackId:track.trackId,title:track.title.trim(),isrc:track.isrc,workIds:Object.freeze([...track.workIds])});
 });
 let artworkUrl=null;
 if(payload.artworkUrl!==null&&payload.artworkUrl!==undefined){
  try{const url=new URL(payload.artworkUrl);if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port||!artworkHosts.includes(url.hostname)) return fail();artworkUrl=url.href;}
  catch{return fail();}
 }
 return Object.freeze({labelId:payload.labelId,releaseId:payload.releaseId,title:payload.title.trim(),releaseDate:payload.releaseDate,
  works:Object.freeze(works),tracks:Object.freeze(tracks),artworkUrl,
  source:Object.freeze({system:payload.source.system,status:payload.source.status,revision:payload.source.revision,observedAtMs:payload.source.observedAtMs})});
}

/** Group only records whose label is in the server-authorized scope. */
export function groupAuthorizedCatalog(records,authorizedLabelIds){
 if(!Array.isArray(records)||!Array.isArray(authorizedLabelIds)||
    authorizedLabelIds.some(label=>typeof label!=='string'||!id.test(label))) return fail();
 const allowed=new Set(authorizedLabelIds),grouped=new Map();
 for(const record of records){
  if(!record||!allowed.has(record.labelId)||!validId(record.releaseId)) return fail();
  const releases=grouped.get(record.labelId)||[];
  if(releases.some(existing=>existing.releaseId===record.releaseId)) return fail();
  releases.push(record);grouped.set(record.labelId,releases);
 }
 return Object.freeze([...grouped].map(([labelId,releases])=>Object.freeze({labelId,releases:Object.freeze(releases)})));
}

/** Keeps revisions isolated by label/release/source to reject late snapshots. */
export function createCatalogRevisionGuard(){
 const latest=new Map();
 return Object.freeze({accept(record,{fingerprint}={}){
  if(fingerprint!==undefined&&(typeof fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(fingerprint))) return false;
  const key=JSON.stringify([record.labelId,record.releaseId,record.source.system]);
  const previous=latest.get(key);
  if(previous!==undefined&&record.source.revision<=previous.revision)
   return record.source.revision===previous.revision&&fingerprint!==undefined&&fingerprint===previous.fingerprint;
  if(previous===undefined&&latest.size>=2048) return false;
  latest.set(key,{revision:record.source.revision,fingerprint});return true;
 }});
}

export function projectLabelRelease(input){
 if(!input||typeof input!=='object'||!validId(input.labelId)||!validId(input.releaseId)||
   !text(input.title)||typeof input.isrc!=='string'||!isrc.test(input.isrc)||
   input.labelVerified!==true||input.sourceVerified!==true) return fail();
 return Object.freeze({labelId:input.labelId,releaseId:input.releaseId,title:input.title.trim(),isrc:input.isrc});
}
