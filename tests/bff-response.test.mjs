import test from 'node:test';
import assert from 'node:assert/strict';
import {readJson} from '../src/bff/response.mjs';
const headers={'content-type':'application/json'};
test('bounded JSON accepts exact byte boundary and rejects multibyte overflow and invalid UTF-8',async()=>{
 const json='{"value":"é"}',bytes=Buffer.byteLength(json);
 assert.deepEqual(await readJson(new Response(json,{headers}),{maxBytes:bytes}),{value:'é'});
 await assert.rejects(readJson(new Response(json,{headers}),{maxBytes:bytes-1}));
 await assert.rejects(readJson(new Response(Uint8Array.from([123,34,120,34,58,34,255,34,125]),{headers}),{maxBytes:100}));
});
test('chunked overflow cancels stream; a dishonest length cannot bypass limit',async()=>{
 let cancelled=false;
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(16));},cancel(){cancelled=true;}});
 await assert.rejects(readJson(new Response(body,{headers:{...headers,'content-length':'1'}}),{maxBytes:20}));
 assert.equal(cancelled,true);
});
test('abort interrupts stalled body consumption and cancels it',async()=>{
 let cancelled=false;const control=new AbortController();
 const body=new ReadableStream({cancel(){cancelled=true;}});
 const pending=readJson(new Response(body,{headers}),{maxBytes:20,signal:control.signal});
 control.abort();await assert.rejects(pending);assert.equal(cancelled,true);
});
test('oversize declarations, non-JSON media types and malformed JSON reject',async()=>{
 for(const response of [new Response('{}',{headers:{...headers,'content-length':'100'}}),
  new Response('{}',{headers:{'content-type':'application/jsonp'}}),new Response('{',{headers})])
  await assert.rejects(readJson(response,{maxBytes:20}));
});
