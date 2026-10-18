import {summarizeTrackZeroEvents} from './speaker-contributions.mjs';

/** Same-origin read-only client. Server derives contributor identity from auth. */
export function createTrackZeroClient({creatorId,fetchImpl=fetch,now=()=>Date.now()}){
 if(typeof creatorId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(creatorId)) throw new Error('Invalid creator');
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/trackzero',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Contributions unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||payload.creatorId!==creatorId||!Array.isArray(payload.events)) throw new Error('Contributions unavailable');
    const summary=summarizeTrackZeroEvents(payload.events,{requestedLabelId:labelId,requestedCreatorId:creatorId,nowMs:now()});
    if(current!==generation) throw new Error('Contribution request superseded');
    const newest=new Map();
    for(const event of payload.events){const key=JSON.stringify([labelId,creatorId,event.eventId]);newest.set(key,Math.max(newest.get(key)??-1,event.source.revision));}
    for(const [key,revision] of newest) if(revisions.has(key)&&revision<revisions.get(key)) throw new Error('Stale contribution event');
    for(const [key,revision] of newest) revisions.set(key,revision);
    return summary;
   }catch(error){if(current!==generation) throw new Error('Contribution request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
