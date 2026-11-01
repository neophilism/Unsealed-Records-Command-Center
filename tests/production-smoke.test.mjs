import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {productionOrigin,productionSmoke} from '../scripts/production-smoke.mjs';
const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
const failure={error:'UNAVAILABLE',message:'Data is unavailable'};
const args={origin:'https://app.example',labelId:'label_0001',report:'streams'};
const good=(url)=>new Response(JSON.stringify(url.pathname==='/healthz'?{status:'ok'}:failure),
 {status:url.pathname==='/healthz'?200:401,headers});
test('production origin excludes credentials, paths, queries, fragments and insecure remote HTTP',()=>{
 assert.equal(productionOrigin('https://app.example/'),'https://app.example');
 for(const value of ['http://app.example','https://user:password@app.example','https://app.example/api',
  'https://app.example/?token=secret','https://app.example/#secret','file:///tmp/app'])
  assert.throws(()=>productionOrigin(value));
 assert.throws(()=>productionOrigin('http://127.0.0.1:3000'));
 assert.equal(productionOrigin('http://127.0.0.1:3000',{allowLoopback:true}),'http://127.0.0.1:3000');
 assert.throws(()=>productionOrigin('http://remote.example',{allowLoopback:true}));
});
test('smoke sends no credential and passes only explicit unauthorized JSON endpoints',async()=>{
 const result=await productionSmoke({...args,fetchImpl:async(url,options)=>{
  assert.deepEqual(options.headers,{accept:'application/json'});assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'manual');return good(url);
 }});
 assert.equal(result.passed,true);assert.equal(result.scope,'anonymous-boundary-only');assert.equal(result.evidence.length,3);
});
test('redirects, anonymous metrics, missing routes and missing private headers fail',async()=>{
 for(const status of [200,302,404,500]) await assert.rejects(productionSmoke({...args,fetchImpl:async url=>
  url.pathname==='/healthz'?good(url):new Response(JSON.stringify(failure),{status,headers})}));
 await assert.rejects(productionSmoke({...args,fetchImpl:async url=>url.pathname==='/healthz'?good(url):
  new Response(JSON.stringify(failure),{status:401,headers:{'content-type':'application/json'}})}));
});
test('private diagnostics, malformed/oversized data and stalled response bodies fail',async()=>{
 for(const body of [JSON.stringify({...failure,detail:'engine secret'}),'{','x'.repeat(4097)])
  await assert.rejects(productionSmoke({...args,fetchImpl:async url=>url.pathname==='/healthz'?good(url):new Response(body,{status:401,headers})}));
 let cancel=false;
 // Keep the test process alive until AbortSignal.timeout fires; production HTTP owns a socket.
 const alive=setInterval(()=>{},1000);
 try{await assert.rejects(productionSmoke({...args,timeoutMs:20,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancel=true;}}),{headers})}));}
 finally{clearInterval(alive);}
 assert.equal(cancel,true);
});
test('loopback HTTP integration verifies actual response headers and route statuses',async()=>{
 const server=http.createServer((req,res)=>{
  res.writeHead(req.url==='/healthz'?200:401,headers);res.end(JSON.stringify(req.url==='/healthz'?{status:'ok'}:failure));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const result=await productionSmoke({...args,origin:'http://127.0.0.1:'+server.address().port,allowLoopback:true});
  assert.equal(result.passed,true);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
