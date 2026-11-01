import {createPublicKey} from 'node:crypto';
import {open,constants} from 'node:fs/promises';
import {isAbsolute} from 'node:path';

function required(env,name){
 const value=env[name];if(typeof value!=='string'||!value||value.length>65536||/[\r\n\0]/.test(value))
  throw new Error('Invalid configuration: '+name);return value;
}
function https(value,name,{origin=false}={}){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||(origin&&u.pathname!=='/')) throw new Error();
  return u;
 }catch{throw new Error('Invalid configuration: '+name);}
}
export async function validateProductionConfig(env,{nowMs=Date.now()}={}){
 const app=https(required(env,'APP_ORIGIN'),'APP_ORIGIN',{origin:true});
 const issuer=required(env,'BFF_ISSUER');https(issuer,'BFF_ISSUER');
 required(env,'BFF_AUDIENCE');
 https(required(env,'ENGINE_ORIGIN'),'ENGINE_ORIGIN',{origin:true});required(env,'ENGINE_TOKEN');
 https(required(env,'OIDC_AUTHORIZATION_ENDPOINT'),'OIDC_AUTHORIZATION_ENDPOINT');
 https(required(env,'OIDC_TOKEN_ENDPOINT'),'OIDC_TOKEN_ENDPOINT');required(env,'OIDC_CLIENT_ID');
 const redirect=https(required(env,'OIDC_REDIRECT_URI'),'OIDC_REDIRECT_URI');
 if(redirect.origin!==app.origin||redirect.pathname!=='/auth/callback') throw new Error('Invalid configuration: OIDC_REDIRECT_URI');
 const sessionKey=required(env,'BFF_SESSION_KEY_BASE64');
 if(!/^[A-Za-z0-9+/]{43}=$/.test(sessionKey)||Buffer.from(sessionKey,'base64').length!==32||
   Buffer.from(sessionKey,'base64').toString('base64')!==sessionKey) throw new Error('Invalid configuration: BFF_SESSION_KEY_BASE64');
 let jwks;
 try{
  jwks=JSON.parse(required(env,'BFF_JWKS_JSON'));
  if(!Array.isArray(jwks.keys)||jwks.keys.length<1||jwks.keys.length>10) throw new Error();
  const ids=new Set();
  for(const key of jwks.keys){
   if(!key||typeof key.kid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(key.kid)||ids.has(key.kid)||
    key.kty!=='RSA'||key.use!=='sig'||key.alg!=='RS256'||['d','p','q','dp','dq','qi','oth'].some(name=>Object.hasOwn(key,name))) throw new Error();
   ids.add(key.kid);
   if(createPublicKey({key,format:'jwk'}).asymmetricKeyDetails.modulusLength<2048) throw new Error();
  }
 }catch{throw new Error('Invalid configuration: BFF_JWKS_JSON');}
 try{
  const reports=JSON.parse(required(env,'BFF_REPORT_ROUTES_JSON'));
  if(!reports||Array.isArray(reports)||Object.keys(reports).length<1||Object.keys(reports).length>64) throw new Error();
  for(const [name,path] of Object.entries(reports)) if(!/^[A-Za-z0-9_-]{1,64}$/.test(name)||typeof path!=='string'||
   !/^\/v1\/labels\/\{labelId\}\/[A-Za-z0-9_/-]+$/.test(path)) throw new Error();
 }catch{throw new Error('Invalid configuration: BFF_REPORT_ROUTES_JSON');}
 const path=required(env,'BFF_MEMBERSHIP_FILE');if(!isAbsolute(path)) throw new Error('Invalid configuration: BFF_MEMBERSHIP_FILE');
 let file;
 try{
  file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const info=await file.stat();
  if(!info.isFile()||(info.mode&0o077)!==0||info.size>1000000) throw new Error();
  const bytes=Buffer.alloc(1000001);let length=0;
  for(;;){const {bytesRead}=await file.read(bytes,length,bytes.length-length,null);length+=bytesRead;
   if(length>1000000) throw new Error();if(!bytesRead) break;}
  const membership=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length)));
  if(membership.issuer!==issuer||membership.version!==1||!Number.isSafeInteger(membership.revision)||membership.revision<1||
   !Number.isSafeInteger(membership.issuedAtMs)||membership.issuedAtMs>nowMs||
   !Number.isSafeInteger(membership.validUntilMs)||membership.validUntilMs<=nowMs||
   membership.validUntilMs-membership.issuedAtMs>86400000||!Array.isArray(membership.grants)) throw new Error();
 }catch{throw new Error('Invalid configuration: BFF_MEMBERSHIP_FILE');}
 finally{await file?.close().catch(()=>{});}
 const port=Number(env.PORT||3000);
 if(!Number.isSafeInteger(port)||port<1||port>65535) throw new Error('Invalid configuration: PORT');
 // Return only a non-sensitive readiness summary, never configuration or claims.
 return {valid:true,port};
}
