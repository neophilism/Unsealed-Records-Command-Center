import {projectLabelCatalog,createCatalogRevisionGuard} from './catalog-identity.mjs';
import {readCatalogResponse} from './catalog-response.mjs';

/** Same-origin catalog reader. Authentication and tenant checks are enforced by the BFF. */
export function createCatalogClient({expectedSource,artworkHosts=[],fetchImpl=fetch,now=()=>Date.now(),timeoutMs=10000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000) throw new Error('Invalid catalog timeout');
 let generation=0,controller=null;
 const revisions=createCatalogRevisionGuard();
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const requestGeneration=generation;
   controller?.abort();const requestController=new AbortController();controller=requestController;
   let timedOut=false;const timer=setTimeout(()=>{timedOut=true;requestController.abort();},timeoutMs);
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/catalog',
      {method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:requestController.signal,headers:{accept:'application/json'}});
    if(!response.ok){await response.body?.cancel();throw new Error('Catalog unavailable');}
    const record=projectLabelCatalog(await readCatalogResponse(response,requestController.signal),{requestedLabelId:labelId,expectedSource,artworkHosts,nowMs:now()});
    if(requestGeneration!==generation) throw new Error('Catalog request superseded');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(record)));
    const fingerprint=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(requestGeneration!==generation) throw new Error('Catalog request superseded');
    requestController.signal.throwIfAborted();
    if(!revisions.accept(record,{fingerprint})) throw new Error('Stale catalog revision');
    return record;
   }catch(error){
    if(requestGeneration!==generation) throw new Error('Catalog request superseded');
    if(timedOut) throw new Error('Catalog request timed out');
    if(error?.message==='Stale catalog revision') throw new Error('Stale catalog revision');
    throw new Error('Catalog unavailable');
   }finally{clearTimeout(timer);if(controller===requestController) controller=null;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
