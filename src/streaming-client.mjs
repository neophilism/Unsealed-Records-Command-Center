import {selectStreamingRecords} from './streaming-insights.mjs';

/** Same-origin reader; the BFF must authenticate and authorize the requested label. */
export function createStreamingClient({expectedSource,fetchImpl=fetch,now=()=>Date.now(),freshnessMs=86400000}){
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId,filters={}){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/streams',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Streaming data unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.records)) throw new Error('Streaming data unavailable');
    const result=selectStreamingRecords(payload.records,{requestedLabelId:labelId,expectedSource,nowMs:now(),freshnessMs,...filters});
    if(current!==generation) throw new Error('Streaming request superseded');
    for(const record of result.records){
      const key=JSON.stringify([labelId,record.period,record.country,record.platform,record.source.system]);
      if(revisions.has(key)&&record.source.revision<revisions.get(key)) throw new Error('Stale streaming revision');
    }
    for(const record of result.records){
      const key=JSON.stringify([labelId,record.period,record.country,record.platform,record.source.system]);
      revisions.set(key,record.source.revision);
    }
    return result;
   }catch(error){if(current!==generation) throw new Error('Streaming request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
