import {projectTooLostDetail} from './toolost-statement.mjs';
import {readStatementResponse} from './toolost-response.mjs';

export function createTooLostClient({fetchImpl=fetch,now=()=>Date.now(),timeoutMs=10000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw new Error('Invalid statement timeout');
 let generation=0,controller=null;const revisions=new Map();
 return Object.freeze({
  async load(labelId,statementId,{sourceKind='live'}={}){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)||typeof statementId!=='string'||
    !/^[A-Za-z0-9_-]{8,128}$/.test(statementId)||!['live','synthetic'].includes(sourceKind)) throw new Error('Invalid statement request');
   const current=++generation;controller?.abort();const request=new AbortController();controller=request;
   let timedOut=false;const timer=setTimeout(()=>{timedOut=true;request.abort();},timeoutMs);
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/toolost',
     {method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:request.signal,headers:{accept:'application/json'}});
    if(!response.ok){await response.body?.cancel();throw new Error();}
    const payload=await readStatementResponse(response,request.signal);
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.statements)||payload.statements.length>100) throw new Error();
    const seen=new Set(),updates=new Map();let selected;
    for(const raw of payload.statements){
     const statement=projectTooLostDetail(raw,{requestedLabelId:labelId,nowMs:now()});
     const key=JSON.stringify([labelId,statement.statementId,statement.source.kind]);
     if(seen.has(key)) throw new Error();seen.add(key);
     const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(statement)));
     const proof=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join(''),previous=revisions.get(key);
     request.signal.throwIfAborted();
     if(previous&&(statement.source.revision<previous.revision||statement.source.revision===previous.revision&&proof!==previous.proof))
      throw new Error('Stale statement revision');
     updates.set(key,{revision:statement.source.revision,proof});
     if(statement.statementId===statementId&&statement.source.kind===sourceKind) selected=statement;
    }
    if(!selected) throw new Error();
    if(current!==generation) throw new Error('Statement request superseded');
    request.signal.throwIfAborted();
    if(new Set([...revisions.keys(),...updates.keys()]).size>2000) throw new Error();
    for(const [key,value] of updates) revisions.set(key,value);
    return selected;
   }catch(error){
    if(current!==generation) throw new Error('Statement request superseded');
    if(timedOut) throw new Error('Statement request timed out');
    if(error?.message==='Stale statement revision') throw new Error('Stale statement revision');
    throw new Error('Statement unavailable');
   }finally{clearTimeout(timer);if(controller===request) controller=null;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
