import {compareTooLostArtifact} from './toolost-artifact.mjs';

/** Invalidating a selection prevents late file reads/hashes from publishing evidence. */
export function createDocumentComparison({onState,now=()=>Date.now()}){
 if(typeof onState!=='function') throw new Error('Invalid document comparison');
 let generation=0;
 return Object.freeze({
  async compare(file,statement,{requestedLabelId}){
   const current=++generation;
   if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>16000000||typeof file.arrayBuffer!=='function'){
    onState(Object.freeze({status:'unavailable',result:null}));return;
   }
   onState(Object.freeze({status:'comparing',result:null}));
   try{
    const buffer=await file.arrayBuffer();if(current!==generation) return;
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<1||buffer.byteLength>16000000) throw new Error();
    const result=await compareTooLostArtifact(new Uint8Array(buffer),statement,{requestedLabelId,nowMs:now()});
    if(current===generation) onState(Object.freeze({status:'compared',result}));
   }catch{if(current===generation) onState(Object.freeze({status:'unavailable',result:null}));}
  },
  clear(){generation++;onState(Object.freeze({status:'cleared',result:null}));}
 });
}
