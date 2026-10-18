import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const id=/^[A-Za-z0-9_-]{8,128}$/;
const fail=()=>{throw new Error('Invalid public event');};
/** Public-only calendar projection. Source ownership/publish approval are server responsibilities. */
export function projectCalendarEvent(x,{requestedLabelId,allowedHosts=[],nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||!x||typeof x!=='object'||Array.isArray(x)||
  x.labelId!==requestedLabelId||x.ownerVerified!==true||x.publishApproved!==true||
  !id.test(x.eventId||'')||typeof x.title!=='string'||x.title.trim().length<2||x.title.length>120||
  typeof x.startsAt!=='string'||typeof x.endsAt!=='string'||
  !Number.isFinite(Date.parse(x.startsAt))||!Number.isFinite(Date.parse(x.endsAt))||
  Date.parse(x.endsAt)<=Date.parse(x.startsAt)||!['scheduled','cancelled','completed'].includes(x.status)||
  x.privateAttendees!==undefined||x.venuePrivateDetails!==undefined||
  !x.source||!Number.isSafeInteger(x.source.revision)||x.source.revision<0||
  !Number.isSafeInteger(x.source.observedAtMs)||x.source.observedAtMs>nowMs+30000) return fail();
 let url;
 try{url=new URL(x.publicUrl);}catch{return fail();}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||
  !allowedHosts.includes(url.hostname)||url.search) return fail();
 return Object.freeze({labelId:x.labelId,eventId:x.eventId,title:x.title.trim(),startsAt:x.startsAt,
  endsAt:x.endsAt,status:x.status,publicUrl:url.href,
  source:Object.freeze({revision:x.source.revision,observedAtMs:x.source.observedAtMs})});
}

export function listCalendarEvents(rows,options){
 if(!Array.isArray(rows)||rows.length>1000) return fail();
 const latest=new Map();
 for(const raw of rows){
  const event=projectCalendarEvent(raw,options),previous=latest.get(event.eventId);
  if(previous&&event.source.revision===previous.source.revision&&JSON.stringify(event)!==JSON.stringify(previous)) return fail();
  if(!previous||event.source.revision>previous.source.revision) latest.set(event.eventId,event);
 }
 return Object.freeze([...latest.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)));
}

/** Signed public campaign link, with no attendee identity or private location. */
export function createQrIssuer({secret,origin,now=()=>Date.now()}){
 if(!Buffer.isBuffer(secret)||secret.length<32) throw new Error('Invalid signing key');
 const site=new URL(origin);
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||site.pathname!=='/') throw new Error('Invalid origin');
 const mac=body=>createHmac('sha256',secret).update(body).digest();
 return Object.freeze({
  issue({labelId,eventId,campaignId,expiresAtMs}){
   if(![labelId,eventId,campaignId].every(x=>typeof x==='string'&&id.test(x))||
     !Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now()||expiresAtMs>now()+86400000) throw new Error('Invalid campaign');
   const payload={labelId,eventId,campaignId,expiresAtMs,nonce:randomBytes(16).toString('base64url')};
   const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
   return new URL('/q/'+body+'.'+mac(body).toString('base64url'),site).href;
  },
  verify(token){
   if(typeof token!=='string'||token.length>2048) return null;
   const parts=token.split('.');if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x))) return null;
   try{
    const signature=Buffer.from(parts[1],'base64url'),expected=mac(parts[0]);
    if(signature.length!==expected.length||!timingSafeEqual(signature,expected)) return null;
    const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(![data.labelId,data.eventId,data.campaignId].every(x=>typeof x==='string'&&id.test(x))||
      !Number.isSafeInteger(data.expiresAtMs)||now()>=data.expiresAtMs) return null;
    return Object.freeze({labelId:data.labelId,eventId:data.eventId,campaignId:data.campaignId});
   }catch{return null;}
  }
 });
}

/** Legacy narrow projection. */
export function projectPublicEvent(x){
 if(!x||x.ownerVerified!==true||x.publishApproved!==true||!id.test(x.eventId||'')||
  typeof x.title!=='string'||x.title.length<2||x.title.length>120||
  !Number.isFinite(Date.parse(x.startsAt))||typeof x.publicUrl!=='string'||!x.publicUrl.startsWith('https://')||
  x.privateAttendees!==undefined||x.venuePrivateDetails!==undefined) return fail();
 return Object.freeze({eventId:x.eventId,title:x.title,startsAt:x.startsAt,publicUrl:x.publicUrl});
}
