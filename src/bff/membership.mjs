import {open,constants} from 'node:fs/promises';
import {isAbsolute} from 'node:path';

const id=/^[A-Za-z0-9_-]{1,128}$/;
const label=/^[A-Za-z0-9_-]{8,128}$/;
const roles=['viewer','operator','owner'];
export function membershipContext(document,identity,labelId,nowMs) {
 if(!identity?.serverVerified||!identity.tokenValid||!Number.isSafeInteger(nowMs)||
   !document||document.version!==1||!Number.isSafeInteger(document.revision)||document.revision<1||
   !Number.isSafeInteger(document.validUntilMs)||document.validUntilMs<=nowMs||
   !Number.isSafeInteger(document.issuedAtMs)||document.issuedAtMs>nowMs||
   document.validUntilMs-document.issuedAtMs>86400000||
   !Array.isArray(document.grants)||document.grants.length>10000) return null;
 const keys=new Set();
 for(const g of document.grants){
  if(!g||typeof g.subject!=='string'||!id.test(g.subject)||typeof g.labelId!=='string'||!label.test(g.labelId)||!roles.includes(g.role)||
    !Number.isSafeInteger(g.notBeforeMs)||!Number.isSafeInteger(g.expiresAtMs)||
    g.expiresAtMs<=g.notBeforeMs||typeof g.active!=='boolean') return null;
  const key=JSON.stringify([g.subject,g.labelId]);if(keys.has(key)) return null;keys.add(key);
 }
 const grant=document.grants.find(g=>g.subject===identity.subject&&g.labelId===labelId&&
  g.active&&g.notBeforeMs<=nowMs&&g.expiresAtMs>nowMs);
 const signed=identity.labelGrants?.find(g=>g?.labelId===labelId&&g.active===true&&
  roles.includes(g.role)&&Number.isSafeInteger(g.expiresAtMs)&&g.expiresAtMs>nowMs);
 if(!grant||!signed) return null;
 return {...identity,membershipRevision:document.revision,labelGrants:[{labelId,active:true,
  role:roles[Math.min(roles.indexOf(grant.role),roles.indexOf(signed.role))],
  expiresAtMs:Math.min(grant.expiresAtMs,signed.expiresAtMs,identity.expiresAtMs,document.validUntilMs)}]};
}

// Read each time: an atomic replacement revokes access before a response is released.
// The file is a private deployment input, never a browser-managed grant registry.
export function fileMembership({path,issuer}) {
 if(typeof path!=='string'||!isAbsolute(path)||!issuer) throw new Error('Invalid membership configuration');
 return async(identity,labelId,nowMs)=>{
  let file;
  try {
   file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   const stat=await file.stat();
   if(!stat.isFile()||stat.size>1000000||(stat.mode&0o077)!==0) return null;
   const buffer=Buffer.alloc(1000001);let size=0;
   for(;;){const {bytesRead}=await file.read(buffer,size,buffer.length-size,null);size+=bytesRead;if(size>1000000) return null;if(!bytesRead) break;}
   const document=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size)));
   if(document.issuer!==issuer) return null;
   return membershipContext(document,identity,labelId,nowMs);
  }catch{return null;}
  finally{await file?.close().catch(()=>{});}
 };
}
