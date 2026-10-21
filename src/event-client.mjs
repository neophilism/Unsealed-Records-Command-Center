import {listCalendarEvents} from './event-calendar.mjs';

/** Same-origin public-calendar reader; BFF must verify owning label. */
export function createEventClient({allowedHosts,fetchImpl=fetch,now=()=>Date.now()}){
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/events',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Calendar unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.events)) throw new Error('Calendar unavailable');
    const events=listCalendarEvents(payload.events,{requestedLabelId:labelId,allowedHosts,nowMs:now()});
    if(current!==generation) throw new Error('Calendar request superseded');
    for(const event of events){const key=JSON.stringify([labelId,event.eventId]);if(revisions.has(key)&&event.source.revision<revisions.get(key)) throw new Error('Stale calendar event');}
    for(const event of events) revisions.set(JSON.stringify([labelId,event.eventId]),event.source.revision);
    return Object.freeze({labelId,events});
   }catch(error){if(current!==generation) throw new Error('Calendar request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
