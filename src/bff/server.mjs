import http from 'node:http';
import {verifyIdentity} from './identity.mjs';
import {permitLabelRequest,publicBffFailure} from './access.mjs';

const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
export function createBff({issuer,audience,jwks,engineOrigin,engineToken,reports,fetchImpl=fetch,now=()=>Date.now()}) {
  if(!issuer||!audience||!jwks?.keys||!engineToken||!engineOrigin||!reports) throw new Error('Missing server configuration');
  const origin=new URL(engineOrigin);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/') throw new Error('Invalid engine origin');
  return http.createServer(async(req,res)=>{
    if(req.method!=='GET'||typeof req.url!=='string'||req.url.length>2048) return send(res,404,publicBffFailure());
    let url;try{url=new URL(req.url,'http://localhost');}catch{return send(res,404,publicBffFailure());}
    if(url.pathname==='/healthz'&&!url.search) return send(res,200,{status:'ok'});
    const route=/^\/api\/labels\/([A-Za-z0-9_-]{8,128})\/reports\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
    if(!route||url.search||!Object.hasOwn(reports,route[2])) return send(res,404,publicBffFailure());
    const auth=req.headers.authorization;
    if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return send(res,401,publicBffFailure());
    const context=verifyIdentity(auth.slice(7),{issuer,audience,jwks,nowMs:now()});
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
