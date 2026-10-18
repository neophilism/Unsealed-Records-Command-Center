import {projectSceneSignalAggregate,createSceneSignalRevisionGuard} from './scenesignal-session.mjs';

/** Same-origin reader of privacy-limited session aggregates. */
export function createSceneSignalClient({fetchImpl=fetch,now=()=>Date.now(),minimumGroupSize=10}){
 let generation=0,controller=null;
 const guard=createSceneSignalRevisionGuard();
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/scenesignal',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sessions unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.sessions)||payload.sessions.length>1000) throw new Error('Sessions unavailable');
    const sessions=payload.sessions.map(x=>projectSceneSignalAggregate(x,{requestedLabelId:labelId,minimumGroupSize,nowMs:now()}));
    if(current!==generation) throw new Error('Session request superseded');
    for(const session of sessions){const state=guard.accept(session);if(state==='stale'||state==='conflict'||state==='state_regression') throw new Error('Session revision conflict');}
    return Object.freeze({labelId,sessions:Object.freeze(sessions)});
   }catch(error){if(current!==generation) throw new Error('Session request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
