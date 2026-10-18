import {projectLabelCatalog,createCatalogRevisionGuard} from './catalog-identity.mjs';

/** Same-origin catalog reader. Authentication and tenant checks are enforced by the BFF. */
export function createCatalogClient({expectedSource,artworkHosts=[],fetchImpl=fetch,now=()=>Date.now()}){
 let generation=0,controller=null;
 const revisions=createCatalogRevisionGuard();
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)) throw new Error('Invalid label');
   generation++;const requestGeneration=generation;
   controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/catalog',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Catalog unavailable');
    const record=projectLabelCatalog(await response.json(),{requestedLabelId:labelId,expectedSource,artworkHosts,nowMs:now()});
    if(requestGeneration!==generation) throw new Error('Catalog request superseded');
    if(!revisions.accept(record)) throw new Error('Stale catalog revision');
    return record;
   }catch(error){
    if(requestGeneration!==generation) throw new Error('Catalog request superseded');
    throw error;
   }
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
