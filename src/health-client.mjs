import {projectSourceObservation,createAlertEvaluator} from './source-health.mjs';

/** Read-only dashboard decisions; delivery and durable alert state are server work. */
export function createSourceHealthClient({baselineByMetric,fetchImpl=fetch,now=()=>Date.now()}){
 const evaluator=createAlertEvaluator();let generation=0,controller=null;
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/health',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Source health unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.observations)||payload.observations.length>1000) throw new Error('Source health unavailable');
    const observedAt=now();
    const observations=payload.observations.map(raw=>projectSourceObservation(raw,{requestedLabelId:labelId,nowMs:observedAt}));
    if(current!==generation) throw new Error('Health request superseded');
    const decisions=payload.observations.map(raw=>{
      const baselineDecimal=baselineByMetric?.[raw.metricId];
      if(baselineDecimal===undefined) return Object.freeze({status:'unknown',alert:false});
      return evaluator.evaluate(raw,{requestedLabelId:labelId,baselineDecimal,nowMs:observedAt});
    });
    return Object.freeze({labelId,observations:Object.freeze(observations),decisions:Object.freeze(decisions)});
   }catch(error){if(current!==generation) throw new Error('Health request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
