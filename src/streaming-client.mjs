import {projectStreamingRecord,selectStreamingRecords} from './streaming-insights.mjs';
import {readStreamingResponse} from './streaming-response.mjs';

function selectedFilters(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['period','country','platform'].includes(key)))
  throw new Error('Invalid streaming filters');
 return {period:value.period,country:value.country,platform:value.platform};
}
export function createStreamingClient({expectedSource,fetchImpl=fetch,now=()=>Date.now(),freshnessMs=86400000,timeoutMs=10000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw new Error('Invalid streaming timeout');
 let generation=0,controller=null;
 const revisions=new Map();
 return Object.freeze({
  async load(labelId,filters={}){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   const selection=selectedFilters(filters);
   const policy={requestedLabelId:labelId,expectedSource,nowMs:now(),freshnessMs};
   selectStreamingRecords([],{...policy,...selection});
   const current=++generation;controller?.abort();const request=new AbortController();controller=request;
   let timedOut=false;const timer=setTimeout(()=>{timedOut=true;request.abort();},timeoutMs);
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/streams',
     {method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:request.signal,headers:{accept:'application/json'}});
    if(!response.ok){await response.body?.cancel();throw new Error();}
    const payload=await readStreamingResponse(response,request.signal);
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.records)) throw new Error();
    const trusted={...policy,nowMs:now()};
    const result=selectStreamingRecords(payload.records,{...trusted,...selection});
    const updates=new Map();
    for(const raw of payload.records){
     const record=projectStreamingRecord(raw,trusted);
     const key=JSON.stringify([labelId,record.period,record.country,record.platform,record.source.system,record.source.kind]);
     const proof=JSON.stringify([record.streams,record.source.kind,record.source.observedAtMs]);
     const newest=updates.get(key);
     if(newest&&record.source.revision<newest.revision) continue;
     updates.set(key,{revision:record.source.revision,proof});
    }
    for(const [key,value] of updates){const known=revisions.get(key);
     if(known&&(value.revision<known.revision||value.revision===known.revision&&value.proof!==known.proof))
      throw new Error('Stale streaming revision');}
    if(current!==generation) throw new Error('Streaming request superseded');
    request.signal.throwIfAborted();
    if(new Set([...revisions.keys(),...updates.keys()]).size>50000) throw new Error();
    for(const [key,value] of updates) revisions.set(key,value);
    return result;
   }catch(error){
    if(current!==generation) throw new Error('Streaming request superseded');
    if(timedOut) throw new Error('Streaming request timed out');
    if(error?.message==='Stale streaming revision') throw new Error('Stale streaming revision');
    throw new Error('Streaming data unavailable');
   }finally{clearTimeout(timer);if(controller===request) controller=null;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
