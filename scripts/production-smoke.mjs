import {pathToFileURL} from 'node:url';

export function productionOrigin(value,{allowLoopback=false}={}) {
 let url;try{url=new URL(value);}catch{throw new Error('Invalid application origin');}
 const loopback=allowLoopback&&url.protocol==='http:'&&['127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!loopback)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
  throw new Error('Invalid application origin');
 return url.origin;
}
async function smallJson(response,signal){
 if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')) throw new Error('Invalid JSON response');
 if(!response.body) throw new Error('Missing response body');
 const reader=response.body.getReader(),chunks=[];let length=0;
 const abort=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done) break;
   length+=value.byteLength;if(length>4096) throw new Error('Oversized smoke response');chunks.push(value);}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function productionSmoke({origin,labelId,report,fetchImpl=fetch,allowLoopback=false,timeoutMs=10000}){
 const base=productionOrigin(origin,{allowLoopback});
 if(typeof labelId!=='string'||typeof report!=='string'||!referenceId(labelId,8,128)||!referenceId(report,1,64))
  throw new Error('Invalid smoke target');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw new Error('Invalid smoke deadline');
 const signal=AbortSignal.timeout(timeoutMs),evidence=[];
 for(const [path,expected] of [['/healthz',[200]],['/api/session',[401]],
  [`/api/labels/${labelId}/reports/${report}`,[401,403]]]){
  let response;
  try{
   response=await fetchImpl(new URL(path,base),{method:'GET',redirect:'manual',signal,
    headers:{accept:'application/json'},credentials:'omit'});
   if(!expected.includes(response.status)) throw new Error('Unexpected endpoint status');
   if(response.headers.get('cache-control')!=='no-store'||response.headers.get('x-content-type-options')!=='nosniff')
    throw new Error('Missing private response headers');
   const body=await smallJson(response,signal);
   if(path==='/healthz'){
    if(!body||body.status!=='ok'||Object.keys(body).some(k=>k!=='status')) throw new Error('Invalid health response');
   }else if(!body||body.error!=='UNAVAILABLE'||body.message!=='Data is unavailable'||Object.keys(body).length!==2)
    throw new Error('Unexpected anonymous response');
   evidence.push({path,status:response.status});
  }catch{await response?.body?.cancel().catch(()=>{});throw new Error('Production smoke failed at '+path);}
 }
 return {passed:true,evidence,scope:'anonymous-boundary-only'};
}
function referenceId(value,min,max){return new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`).test(value);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await productionSmoke({origin:process.argv[2],labelId:process.argv[3],report:process.argv[4]});
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
