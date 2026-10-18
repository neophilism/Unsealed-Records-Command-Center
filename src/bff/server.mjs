import http from 'node:http';
import {verifyIdentity} from './identity.mjs';
import {permitLabelRequest,publicBffFailure} from './access.mjs';
import {cookie,cookieValue,oidcLogin,seal,unseal,validOidcConfig} from './oidc.mjs';

const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
export function createBff({issuer,audience,jwks,engineOrigin,engineToken,reports,oidc,sessionKey,fetchImpl=fetch,now=()=>Date.now()}) {
  if(!issuer||!audience||!jwks?.keys||!engineToken||!engineOrigin||!reports) throw new Error('Missing server configuration');
  const origin=new URL(engineOrigin);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/') throw new Error('Invalid engine origin');
  if(oidc&&(!validOidcConfig(oidc)||!Buffer.isBuffer(sessionKey)||sessionKey.length!==32)) throw new Error('Invalid OIDC configuration');
  return http.createServer(async(req,res)=>{
    if(req.method!=='GET'||typeof req.url!=='string'||req.url.length>2048) return send(res,404,publicBffFailure());
    let url;try{url=new URL(req.url,'http://localhost');}catch{return send(res,404,publicBffFailure());}
    if(url.pathname==='/healthz'&&!url.search) return send(res,200,{status:'ok'});
    if(oidc&&url.pathname==='/auth/login'&&!url.search){
      const {url:location,pending}=oidcLogin(oidc,sessionKey,now());
      res.writeHead(302,{location,'cache-control':'no-store','set-cookie':cookie('bff_pending',pending,300)});
      return res.end();
    }
    if(oidc&&url.pathname==='/auth/callback'){
      const pending=unseal(cookieValue(req.headers.cookie,'bff_pending'),sessionKey);
      res.setHeader('set-cookie',cookie('bff_pending','',0));
      if(!pending||!Number.isSafeInteger(pending.createdAtMs)||now()-pending.createdAtMs>300000||
        now()<pending.createdAtMs||url.searchParams.size!==2||
        url.searchParams.get('state')!==pending.state||!url.searchParams.get('code')) return send(res,401,publicBffFailure());
      try{
        const response=await fetchImpl(oidc.tokenEndpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},body:new URLSearchParams({grant_type:'authorization_code',code:url.searchParams.get('code'),client_id:oidc.clientId,redirect_uri:oidc.redirectUri,code_verifier:pending.verifier})});
        if(!response.ok) return send(res,401,publicBffFailure());
        const body=await response.json();
        const identity=verifyIdentity(body.id_token,{issuer,audience,jwks,nowMs:now()});
        if(!identity||identity.nonce!==pending.nonce) return send(res,401,publicBffFailure());
        res.setHeader('set-cookie',[cookie('bff_pending','',0),cookie('bff_session',seal({token:body.id_token},sessionKey),Math.min(300,Math.floor((identity.expiresAtMs-now())/1000)))]);
        res.writeHead(303,{location:'/', 'cache-control':'no-store'});return res.end();
      }catch{return send(res,401,publicBffFailure());}
    }
    if(oidc&&url.pathname==='/auth/logout'&&!url.search){
      res.writeHead(303,{location:'/', 'cache-control':'no-store','set-cookie':cookie('bff_session','',0)});return res.end();
    }
    const route=/^\/api\/labels\/([A-Za-z0-9_-]{8,128})\/reports\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
    if(!route||url.search||!Object.hasOwn(reports,route[2])) return send(res,404,publicBffFailure());
    const auth=req.headers.authorization;
    let token;
    if(typeof auth==='string'&&/^Bearer [A-Za-z0-9._-]+$/.test(auth)) token=auth.slice(7);
    else if(oidc){const session=unseal(cookieValue(req.headers.cookie,'bff_session'),sessionKey);token=session?.token;}
    if(!token) return send(res,401,publicBffFailure());
    const context=verifyIdentity(token,{issuer,audience,jwks,nowMs:now()});
    if(!permitLabelRequest(context,route[1],now())) return send(res,403,publicBffFailure());
    const template=reports[route[2]];
    if(typeof template!=='string'||!/^\/v1\/labels\/\{labelId\}\/[A-Za-z0-9_/-]+$/.test(template)) return send(res,503,publicBffFailure());
    const target=new URL(template.replace('{labelId}',encodeURIComponent(route[1])),origin);
    if(target.origin!==origin.origin) return send(res,503,publicBffFailure());
    try {
      const response=await fetchImpl(target,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),headers:{authorization:'Bearer '+engineToken,accept:'application/json'}});
      if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) return send(res,502,publicBffFailure());
      const raw=await response.text();
      if(raw.length>1_000_000) return send(res,502,publicBffFailure());
      const data=JSON.parse(raw);
      if(!data||typeof data!=='object'||Array.isArray(data)||data.labelId!==route[1]) return send(res,502,publicBffFailure());
      return send(res,200,data);
    }catch{return send(res,502,publicBffFailure());}
  });
}
