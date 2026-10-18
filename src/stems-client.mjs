import {projectStemsReceipt,createStemsReceiptGuard} from './stems-commerce.mjs';

/** Read-only receipt client. No checkout or entitlement grant is performed here. */
export function createStemsClient({fetchImpl=fetch,now=()=>Date.now()}){
 let generation=0,controller=null;
 const guard=createStemsReceiptGuard();
 return Object.freeze({
  async load(labelId,orderId){
   if(typeof labelId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(labelId)||
      typeof orderId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(orderId)) throw new Error('Invalid receipt request');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/stems',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Receipt unavailable');
    const payload=await response.json();
    if(!payload||payload.labelId!==labelId||!Array.isArray(payload.receipts)||payload.receipts.length>100) throw new Error('Receipt unavailable');
    const matched=payload.receipts.filter(item=>item.orderId===orderId);
    if(matched.length!==1) throw new Error('Receipt unavailable');
    const receipt=projectStemsReceipt(matched[0],{requestedLabelId:labelId,nowMs:now()});
    if(current!==generation) throw new Error('Receipt request superseded');
    const result=guard.accept(receipt);
    if(result==='conflict'||result==='stale') throw new Error('Receipt revision conflict');
    return receipt;
   }catch(error){if(current!==generation) throw new Error('Receipt request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
