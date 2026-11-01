export async function readCatalogResponse(response,signal){
 if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||!response.body)
  throw new Error('Catalog unavailable');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>1000000)){
  await response.body.cancel();throw new Error('Catalog unavailable');
 }
 const reader=response.body.getReader(),chunks=[];let size=0;
 const abort=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done) break;
   size+=value.byteLength;if(size>1000000) throw new Error('Catalog unavailable');chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
