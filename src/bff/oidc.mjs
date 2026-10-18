import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';

const b64=b=>Buffer.from(b).toString('base64url');
export function seal(value,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return b64(Buffer.concat([iv,cipher.getAuthTag(),ciphertext]));
}
export function unseal(value,key){
 try {
  if(typeof value!=='string'||value.length>20000) return null;
  const raw=Buffer.from(value,'base64url');if(raw.length<29) return null;
  const decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));
  decipher.setAuthTag(raw.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8'));
 }catch{return null;}
}
export function cookieValue(header,name){
 if(typeof header!=='string') return null;
 const entries=header.split(';').map(x=>x.trim());
 const match=entries.find(x=>x.startsWith(name+'='));
 return match?match.slice(name.length+1):null;
}
export function oidcLogin(config,key,nowMs){
 const state=b64(randomBytes(24)),nonce=b64(randomBytes(24)),verifier=b64(randomBytes(32));
 const challenge=b64(createHash('sha256').update(verifier).digest());
 const url=new URL(config.authorizationEndpoint);
 url.searchParams.set('response_type','code');url.searchParams.set('client_id',config.clientId);
 url.searchParams.set('redirect_uri',config.redirectUri);url.searchParams.set('scope','openid');
 url.searchParams.set('state',state);url.searchParams.set('nonce',nonce);
 url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');
 const pending=seal({state,nonce,verifier,createdAtMs:nowMs},key);
 return {url:url.href,pending};
}
export function validOidcConfig(config){
 try {
  const authorization=new URL(config.authorizationEndpoint),token=new URL(config.tokenEndpoint),redirect=new URL(config.redirectUri);
  return authorization.protocol==='https:'&&token.protocol==='https:'&&redirect.protocol==='https:'&&
   typeof config.clientId==='string'&&config.clientId.length>0&&
   !authorization.username&&!authorization.password&&!token.username&&!token.password;
 }catch{return false;}
}
export function cookie(name,value,maxAge){
 return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
