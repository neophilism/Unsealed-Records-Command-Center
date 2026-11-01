import {projectSalesEvent,summarizeSalesEvents} from './storefront-sales.mjs';
import {readSalesResponse} from './sales-response.mjs';

export function createSalesClient({expectedSource,fetchImpl=fetch,now=()=>Date.now(),timeoutMs=10000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw new Error('Invalid sales timeout');
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId,filters={}){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.keys(filters).some(k=>!['period','country','storefront'].includes(k)))
    throw new Error('Invalid sales filters');
   const selected={period:filters.period,country:filters.country,storefront:filters.storefront};
   summarizeSalesEvents([],{requestedLabelId:labelId,expectedSource,nowMs:now(),...selected});
   const current=++generation;controller?.abort();const request=new AbortController();controller=request;
   let timedOut=false;const timer=setTimeout(()=>{timedOut=true;request.abort();},timeoutMs);
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/sales',
     {method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:request.signal,headers:{accept:'application/json'}});
    if(!response.ok){await response.body?.cancel();throw new Error();}
    const payload=await readSalesResponse(response,request.signal);
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.events)) throw new Error();
    const policy={requestedLabelId:labelId,expectedSource,nowMs:now()};
    const summary=summarizeSalesEvents(payload.events,{...policy,...selected});
    const updates=new Map();
    for(const raw of payload.events){
     const event=projectSalesEvent(raw,policy),key=JSON.stringify([labelId,event.source.kind,event.eventId]);
     const proof=JSON.stringify(event),newest=updates.get(key);
     if(!newest||event.source.revision>newest.revision) updates.set(key,{revision:event.source.revision,proof});
    }
    for(const [key,value] of updates){const previous=revisions.get(key);
     if(previous&&(value.revision<previous.revision||value.revision===previous.revision&&value.proof!==previous.proof))
      throw new Error('Stale sales event');}
    if(current!==generation) throw new Error('Sales request superseded');
    request.signal.throwIfAborted();
    if(new Set([...revisions.keys(),...updates.keys()]).size>50000) throw new Error();
    for(const [key,value] of updates) revisions.set(key,value);
    return summary;
   }catch(error){
    if(current!==generation) throw new Error('Sales request superseded');
    if(timedOut) throw new Error('Sales request timed out');
    if(error?.message==='Stale sales event') throw new Error('Stale sales event');
    throw new Error('Sales data unavailable');
   }finally{clearTimeout(timer);if(controller===request) controller=null;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
