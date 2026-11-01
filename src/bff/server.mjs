import http from 'node:http';
import {readJson} from './response.mjs';
import {verifyIdentity} from './identity.mjs';
import {permitLabelRequest,publicBffFailure} from './access.mjs';
import {cookie,cookieValue,oidcLogin,seal,unseal,validOidcConfig} from './oidc.mjs';

const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
function safeNumbers(value){
 if(typeof value==='number') return Number.isFinite(value)&&(!Number.isInteger(value)||Number.isSafeInteger(value));
 if(Array.isArray(value)) return value.every(safeNumbers);
 if(value&&typeof value==='object') return Object.values(value).every(safeNumbers);
 return true;
}
export function createBff({issuer,audience,jwks,engineOrigin,engineToken,reports,oidc,sessionKey,checkMembership=async()=>null,fetchImpl=fetch,now=()=>Date.now()}) {
  if(!issuer||!audience||!jwks?.keys||!engineToken||!engineOrigin||!reports) throw new Error('Missing server configuration');
  const origin=new URL(engineOrigin);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/') throw new Error('Invalid engine origin');
  if(oidc&&(!validOidcConfig(oidc)||!Buffer.isBuffer(sessionKey)||sessionKey.length!==32)) throw new Error('Invalid OIDC configuration');
  const authorize=async(identity,labelId)=>{
    try {const current=await checkMembership(identity,labelId,now());
      return current?.subject===identity?.subject&&permitLabelRequest(current,labelId,now())?current:null;
    }catch{return null;}
  };
  return http.createServer(async(req,res)=>{
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('cache-control','no-store');
    if(oidc&&req.method==='POST'&&req.url==='/auth/logout'){
      if(req.headers.origin!==new URL(oidc.redirectUri).origin||req.headers['sec-fetch-site']==='cross-site')
        return send(res,403,publicBffFailure());
      res.writeHead(303,{location:'/', 'set-cookie':cookie('__Host-bff_session','',0)});return res.end();
    }
    if(req.method!=='GET'||typeof req.url!=='string'||req.url.length>2048) return send(res,404,publicBffFailure());
    let url;try{url=new URL(req.url,'http://localhost');}catch{return send(res,404,publicBffFailure());}
    if(url.pathname==='/healthz'&&!url.search) return send(res,200,{status:'ok'});
    if(oidc&&url.pathname==='/auth/login'&&!url.search){
      const {url:location,pending}=oidcLogin(oidc,sessionKey,now());
      res.writeHead(302,{location,'cache-control':'no-store','set-cookie':cookie('__Host-bff_pending',pending,300)});
      return res.end();
    }
    if(oidc&&url.pathname==='/auth/callback'){
      const pending=unseal(cookieValue(req.headers.cookie,'__Host-bff_pending'),sessionKey);
      res.setHeader('set-cookie',cookie('__Host-bff_pending','',0));
      if(!pending||!Number.isSafeInteger(pending.createdAtMs)||now()-pending.createdAtMs>300000||
        now()<pending.createdAtMs||url.searchParams.size!==2||
        url.searchParams.get('state')!==pending.state||!url.searchParams.get('code')) return send(res,401,publicBffFailure());
      try{
        const signal=AbortSignal.timeout(8000);
        const response=await fetchImpl(oidc.tokenEndpoint,{method:'POST',redirect:'error',signal,headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},body:new URLSearchParams({grant_type:'authorization_code',code:url.searchParams.get('code'),client_id:oidc.clientId,redirect_uri:oidc.redirectUri,code_verifier:pending.verifier})});
        if(!response.ok){await response.body?.cancel();return send(res,401,publicBffFailure());}
        const body=await readJson(response,{maxBytes:20000,signal});
        const identity=verifyIdentity(body.id_token,{issuer,audience,jwks,nowMs:now()});
        if(!identity||identity.nonce!==pending.nonce) return send(res,401,publicBffFailure());
        const session=seal({token:body.id_token},sessionKey);
        // Browsers reject cookies larger than 4096 bytes; never silently issue an unusable login.
        if(session.length>3800) return send(res,401,publicBffFailure());
        res.setHeader('set-cookie',[cookie('__Host-bff_pending','',0),cookie('__Host-bff_session',session,Math.min(300,Math.floor((identity.expiresAtMs-now())/1000)))]);
        res.writeHead(303,{location:'/', 'cache-control':'no-store'});return res.end();
      }catch{return send(res,401,publicBffFailure());}
    }
    const route=/^\/api\/labels\/([A-Za-z0-9_-]{8,128})\/reports\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
    const sessionRoute=url.pathname==='/api/session'&&!url.search;
    if(!sessionRoute&&(!route||url.search||!Object.hasOwn(reports,route[2]))) return send(res,404,publicBffFailure());
    const auth=req.headers.authorization;
    let token;
    if(typeof auth==='string'&&/^Bearer [A-Za-z0-9._-]+$/.test(auth)) token=auth.slice(7);
    else if(auth!==undefined) return send(res,401,publicBffFailure());
    else if(oidc){const session=unseal(cookieValue(req.headers.cookie,'__Host-bff_session'),sessionKey);token=session?.token;}
    if(!token) return send(res,401,publicBffFailure());
    const context=verifyIdentity(token,{issuer,audience,jwks,nowMs:now()});
    if(sessionRoute){
      if(!context) return send(res,401,publicBffFailure());
      const labels=[];
      const seen=new Set();
      for(const grant of context.labelGrants){
        if(!permitLabelRequest(context,grant?.labelId,now())||seen.has(grant.labelId)) continue;
        seen.add(grant.labelId);
        const current=await authorize(context,grant.labelId);
        if(current){const active=current.labelGrants.find(g=>g.labelId===grant.labelId&&g.active===true);
          labels.push({labelId:grant.labelId,role:active.role,expiresAtMs:Math.min(active.expiresAtMs,context.expiresAtMs)});}
      }
      if(context.expiresAtMs<=now()) return send(res,401,publicBffFailure());
      return send(res,200,{subject:context.subject,expiresAtMs:context.expiresAtMs,labels});
    }
    if(!permitLabelRequest(context,route[1],now())) return send(res,403,publicBffFailure());
    if(!await authorize(context,route[1])) return send(res,403,publicBffFailure());
    const template=reports[route[2]];
    if(typeof template!=='string'||!/^\/v1\/labels\/\{labelId\}\/[A-Za-z0-9_/-]+$/.test(template)) return send(res,503,publicBffFailure());
    const target=new URL(template.replace('{labelId}',encodeURIComponent(route[1])),origin);
    if(target.origin!==origin.origin) return send(res,503,publicBffFailure());
    try {
      const signal=AbortSignal.timeout(8000);
      const response=await fetchImpl(target,{method:'GET',redirect:'error',signal,headers:{authorization:'Bearer '+engineToken,accept:'application/json'}});
      if(!response.ok){await response.body?.cancel();return send(res,502,publicBffFailure());}
      const data=await readJson(response,{maxBytes:1_000_000,signal});
      if(!data||typeof data!=='object'||Array.isArray(data)||data.labelId!==route[1]||!safeNumbers(data)||
        !permitLabelRequest(context,route[1],now())||!await authorize(context,route[1])) return send(res,502,publicBffFailure());
      return send(res,200,data);
    }catch{return send(res,502,publicBffFailure());}
  });
}
