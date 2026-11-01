export async function readStreamingResponse(response,signal){
 if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||!response.body)
  throw new Error('Streaming data unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;
 const abort=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done) break;
   size+=value.byteLength;if(size>2000000) throw new Error('Streaming data unavailable');chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
