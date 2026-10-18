import {projectTooLostDetail} from './toolost-statement.mjs';

/** Same-origin statement client; BFF must authenticate provider and label. */
export function createTooLostClient({fetchImpl=fetch,now=()=>Date.now()}){
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId,statementId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)||
      typeof statementId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(statementId)) throw new Error('Invalid statement request');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/toolost',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Statement unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.statements)||payload.statements.length>100) throw new Error('Statement unavailable');
    const candidates=payload.statements.filter(item=>item.statementId===statementId);
    if(candidates.length!==1) throw new Error('Statement unavailable');
    const statement=projectTooLostDetail(candidates[0],{requestedLabelId:labelId,nowMs:now()});
    if(current!==generation) throw new Error('Statement request superseded');
    const key=JSON.stringify([labelId,statementId]);
    if(revisions.has(key)&&statement.source.revision<revisions.get(key)) throw new Error('Stale statement revision');
    revisions.set(key,statement.source.revision);
    return statement;
   }catch(error){if(current!==generation) throw new Error('Statement request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
