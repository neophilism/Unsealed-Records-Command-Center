import {createPublicKey,verify} from 'node:crypto';

export function verifyIdentity(token,{issuer,audience,jwks,nowMs=Date.now()}) {
  if(typeof token!=='string'||token.length>16384) return null;
  try {
    const parts=token.split('.');
    if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p))) return null;
    const decode=p=>JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
    const header=decode(parts[0]),claims=decode(parts[1]);
    if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string') return null;
    const keys=jwks?.keys?.filter(k=>k?.kid===header.kid&&k.kty==='RSA'&&k.use==='sig'&&k.alg==='RS256');
    if(keys?.length!==1||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),
      createPublicKey({key:keys[0],format:'jwk'}),Buffer.from(parts[2],'base64url'))) return null;
    const now=Math.floor(nowMs/1000);
    if(claims.iss!==issuer||claims.aud!==audience||typeof claims.sub!=='string'||
      !/^[A-Za-z0-9_-]{1,128}$/.test(claims.sub)||!Number.isSafeInteger(claims.iat)||
      !Number.isSafeInteger(claims.exp)||claims.exp<=now||claims.iat>now+30||
      claims.exp-claims.iat>300||!Array.isArray(claims.labelGrants)||claims.labelGrants.length>100||
      (claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now))) return null;
    return {serverVerified:true,tokenValid:true,subject:claims.sub,expiresAtMs:claims.exp*1000,labelGrants:claims.labelGrants};
  } catch {return null;}
}
