import {summarizeSalesEvents} from './storefront-sales.mjs';

/** Same-origin sales reader; authenticated BFF supplies normalized events. */
export function createSalesClient({expectedSource,fetchImpl=fetch,now=()=>Date.now()}){
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId,filters={}){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/sales',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sales data unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.events)) throw new Error('Sales data unavailable');
    const summary=summarizeSalesEvents(payload.events,{requestedLabelId:labelId,expectedSource,nowMs:now(),...filters});
    if(current!==generation) throw new Error('Sales request superseded');
    const newest=new Map();
    for(const event of payload.events){
      const key=JSON.stringify([labelId,event.eventId]);
      newest.set(key,Math.max(newest.get(key)??-1,event.source.revision));
    }
    for(const [key,revision] of newest) if(revisions.has(key)&&revision<revisions.get(key)) throw new Error('Stale sales event');
    for(const [key,revision] of newest) revisions.set(key,revision);
    return summary;
   }catch(error){if(current!==generation) throw new Error('Sales request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
