// Bound bytes while consuming the stream, not after allocating the whole body.
export async function readJson(response, {maxBytes, signal}) {
 const length=response.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes)) {
  await response.body?.cancel();throw new Error('Invalid response length');
 }
 if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||!response.body) {
  await response.body?.cancel();throw new Error('Invalid response type');
 }
 const reader=response.body.getReader(),chunks=[];let size=0;
 const abort=()=>{reader.cancel().catch(()=>{});};
 signal?.addEventListener('abort',abort,{once:true});
 try {
  signal?.throwIfAborted();
  for(;;){
   const {done,value}=await reader.read();signal?.throwIfAborted();
   if(done) break;
   size+=value.byteLength;
   if(size>maxBytes) throw new Error('Response too large');
   chunks.push(value);
  }
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
}
