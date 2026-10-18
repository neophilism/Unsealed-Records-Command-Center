import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createBff} from './server.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key1',use:'sig',alg:'RS256'};
function token(overrides={}){
 const claims={iss:'issuer',aud:'dashboard',sub:'user_001',iat:1800000000,exp:1800000300,labelGrants:[{labelId:'label_0001',active:true,role:'viewer',expiresAtMs:1800000300000}],...overrides};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const body=enc({alg:'RS256',typ:'JWT',kid:'key1'})+'.'+enc(claims);
 return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
}
async function withServer(fetchImpl,fn){
 const server=createBff({issuer:'issuer',audience:'dashboard',jwks:{keys:[jwk]},engineOrigin:'https://engine.example/',engineToken:'server-secret',reports:{streams:'/v1/labels/{labelId}/reports/streams'},fetchImpl,now:()=>1800000000000});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('verified scoped identity and server-only proxy',async()=>{
 let calls=0;
 await withServer(async(url,opts)=>{calls++;assert.equal(url.href,'https://engine.example/v1/labels/label_0001/reports/streams');assert.equal(opts.headers.authorization,'Bearer server-secret');return new Response(JSON.stringify({labelId:'label_0001',count:'9007199254740993'}),{headers:{'content-type':'application/json'}});},async base=>{
  const path='/api/labels/label_0001/reports/streams';
  const request=(p,t)=>fetch(base+p,{headers:t?{authorization:'Bearer '+t}:{}});
  const good=await request(path,token());assert.equal(good.status,200);assert.equal((await good.json()).count,'9007199254740993');
  for(const [p,t,code] of [[path,null,401],['/api/labels/label_0002/reports/streams',token(),403],[path,token({exp:1800000000}),403],[path,token({aud:'other'}),403],[path,token({labelGrants:[]}),403],[path+'?url=evil',token(),404]]) assert.equal((await request(p,t)).status,code,p);
  assert.equal(calls,1);
 });
});
test('wrong-label upstream payload fails closed',async()=>{
 await withServer(async()=>new Response(JSON.stringify({labelId:'label_0002'}),{headers:{'content-type':'application/json'}}),async base=>{
  const response=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'UNAVAILABLE',message:'Data is unavailable'});
 });
});
