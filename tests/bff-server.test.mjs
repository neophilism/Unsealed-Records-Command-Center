import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createBff} from '../src/bff/server.mjs';
import {seal} from '../src/bff/oidc.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key1',use:'sig',alg:'RS256'};
function token(overrides={}){
 const claims={iss:'issuer',aud:'dashboard',sub:'user_001',iat:1800000000,exp:1800000300,labelGrants:[{labelId:'label_0001',active:true,role:'viewer',expiresAtMs:1800000300000}],...overrides};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const body=enc({alg:'RS256',typ:'JWT',kid:'key1'})+'.'+enc(claims);
 return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
}
async function withServer(fetchImpl,fn,overrides={}){
 const server=createBff({issuer:'issuer',audience:'dashboard',jwks:{keys:[jwk]},checkMembership:async identity=>identity,engineOrigin:'https://engine.example/',engineToken:'server-secret',reports:{streams:'/v1/labels/{labelId}/reports/streams'},fetchImpl,now:()=>1800000000000,...overrides});
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
test('membership revocation during an upstream request prevents disclosure',async()=>{
 let active=true,calls=0,checks=0;
 await withServer(async()=>{calls++;active=false;return new Response(JSON.stringify({labelId:'label_0001',private:'must not disclose'}),{headers:{'content-type':'application/json'}});},async base=>{
  const result=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  assert.equal(result.status,502);assert.deepEqual(await result.json(),{error:'UNAVAILABLE',message:'Data is unavailable'});
  assert.equal(calls,1);assert.equal(checks,2);
 },{checkMembership:async identity=>{checks++;return active?identity:null;}});
});
test('missing, unavailable and mismatched current membership never reach the engine',async()=>{
 for(const checkMembership of [undefined,async()=>null,async()=>{throw new Error('private storage failure');},
  async identity=>({...identity,subject:'other'}),async identity=>({...identity,labelGrants:[]})]){
  let calls=0;
  await withServer(async()=>{calls++;throw new Error('unexpected');},async base=>{
   const result=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
   assert.equal(result.status,403);assert.equal(calls,0);assert.doesNotMatch(await result.text(),/private|secret/);
  },{checkMembership});
 }
});
test('expired identity while streaming fails closed and next request can retry safely',async()=>{
 let clock=1800000000000,calls=0;
 await withServer(async()=>{calls++;clock+=300000;return new Response(JSON.stringify({labelId:'label_0001'}),{headers:{'content-type':'application/json'}});},async base=>{
  const result=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  assert.equal(result.status,502);assert.equal(calls,1);
  const expired=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  assert.equal(expired.status,403);assert.equal(calls,1);
 },{now:()=>clock});
});
test('upstream errors and redirects do not expose provider text; explicit retry succeeds',async()=>{
 let calls=0;
 await withServer(async(_url,options)=>{
  assert.equal(options.redirect,'error');calls++;
  if(calls===1) return new Response('provider secret',{status:503});
  if(calls===2) throw new Error('redirect to private provider');
  return new Response(JSON.stringify({labelId:'label_0001',source:{status:'cached',revision:'42'},count:'9007199254740993'}),{headers:{'content-type':'application/json'}});
 },async base=>{
  const get=()=>fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  for(let i=0;i<2;i++){const result=await get();assert.equal(result.status,502);assert.doesNotMatch(await result.text(),/provider|secret/);}
  const result=await get();assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
  assert.deepEqual((await result.json()).source,{status:'cached',revision:'42'});assert.equal(calls,3);
 });
});
test('wrong-label upstream payload fails closed',async()=>{
 await withServer(async()=>new Response(JSON.stringify({labelId:'label_0002'}),{headers:{'content-type':'application/json'}}),async base=>{
  const response=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'UNAVAILABLE',message:'Data is unavailable'});
 });
});
test('unsafe large JSON numbers are rejected rather than silently rounded',async()=>{
 await withServer(async()=>new Response('{"labelId":"label_0001","count":9007199254740993}',{headers:{'content-type':'application/json'}}),async base=>{
  const response=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{authorization:'Bearer '+token()}});
  assert.equal(response.status,502);
 });
});
test('OIDC code flow binds state, nonce and PKCE before issuing secure session',async()=>{
 let nonce,tokenCalls=0,reportCalls=0;
 const server=createBff({issuer:'issuer',audience:'dashboard',jwks:{keys:[jwk]},checkMembership:async identity=>identity,engineOrigin:'https://engine.example/',engineToken:'server-secret',reports:{streams:'/v1/labels/{labelId}/reports/streams'},now:()=>1800000000000,
  oidc:{authorizationEndpoint:'https://id.example/authorize',tokenEndpoint:'https://id.example/token',redirectUri:'https://app.example/auth/callback',clientId:'client-1'},sessionKey:Buffer.alloc(32,7),
  fetchImpl:async(url,options)=>{
   if(url==='https://id.example/token'){
    tokenCalls++;assert.equal(options.body.get('grant_type'),'authorization_code');
    assert.ok(options.body.get('code_verifier'));
    return new Response(JSON.stringify({id_token:token({nonce})}),{headers:{'content-type':'application/json'}});
   }
   reportCalls++;return new Response(JSON.stringify({labelId:'label_0001'}),{headers:{'content-type':'application/json'}});
  }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const login=await fetch(base+'/auth/login',{redirect:'manual'});assert.equal(login.status,302);
  const location=new URL(login.headers.get('location'));nonce=location.searchParams.get('nonce');
  assert.equal(location.searchParams.get('code_challenge_method'),'S256');
  const pending=login.headers.get('set-cookie').split(';')[0];
  const invalid=await fetch(base+'/auth/callback?code=abc&state=wrong',{headers:{cookie:pending},redirect:'manual'});
  assert.equal(invalid.status,401);assert.equal(tokenCalls,0);
  const callback=await fetch(base+'/auth/callback?code=abc&state='+location.searchParams.get('state'),{headers:{cookie:pending},redirect:'manual'});
  assert.equal(callback.status,303);assert.equal(tokenCalls,1);
  const cookies=callback.headers.getSetCookie();const session=cookies.find(x=>x.startsWith('__Host-bff_session='));
  assert.match(session,/HttpOnly; Secure; SameSite=Lax/);
  const ok=await fetch(base+'/api/labels/label_0001/reports/streams',{headers:{cookie:session.split(';')[0]}});
  assert.equal(ok.status,200);assert.equal(reportCalls,1);
  const denied=await fetch(base+'/api/labels/label_0002/reports/streams',{headers:{cookie:session.split(';')[0]}});
  assert.equal(denied.status,403);assert.equal(reportCalls,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

async function withOidc(exchange,fn,overrides={}){
 const oidc={authorizationEndpoint:'https://id.example/authorize',tokenEndpoint:'https://id.example/token',redirectUri:'https://app.example/auth/callback',clientId:'client-1'};
 const server=createBff({issuer:'issuer',audience:'dashboard',jwks:{keys:[jwk]},checkMembership:async identity=>identity,
  engineOrigin:'https://engine.example/',engineToken:'server-secret',reports:{streams:'/v1/labels/{labelId}/reports/streams'},
  oidc,sessionKey:Buffer.alloc(32,7),fetchImpl:exchange,now:()=>1800000000000,...overrides});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}
async function login(base){
 const response=await fetch(base+'/auth/login',{redirect:'manual'}),url=new URL(response.headers.get('location'));
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 return {cookie:response.headers.get('set-cookie').split(';')[0],state:url.searchParams.get('state'),nonce:url.searchParams.get('nonce')};
}
test('callback rejects missing/duplicate parameters and expired or future pending state before exchange',async()=>{
 let calls=0;
 await withOidc(async()=>{calls++;throw new Error('must not exchange');},async base=>{
  const pending=await login(base);
  for(const path of ['/auth/callback?code=a','/auth/callback?state='+pending.state,
   '/auth/callback?code=a&state='+pending.state+'&state='+pending.state,
   '/auth/callback?code=a&state='+pending.state+'&extra=a']){
   const r=await fetch(base+path,{headers:{cookie:pending.cookie},redirect:'manual'});assert.equal(r.status,401);
   assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
  }
  for(const createdAtMs of [1799999699999,1800000000001]){
   const value=seal({createdAtMs,state:'state',nonce:'nonce',verifier:'fixture'},Buffer.alloc(32,7));
   const r=await fetch(base+'/auth/callback?code=a&state=state',{headers:{cookie:'__Host-bff_pending='+value},redirect:'manual'});
   assert.equal(r.status,401);
  }
  assert.equal(calls,0);
 });
});
test('callback rejects wrong nonce, invalid identity, malformed responses and cookie overflow',async()=>{
 const fixtures=[()=>new Response(JSON.stringify({id_token:token({nonce:'wrong'})}),{headers:{'content-type':'application/json'}}),
  nonce=>new Response(JSON.stringify({id_token:token({nonce,aud:'other'})}),{headers:{'content-type':'application/json'}}),
  ()=>new Response('provider secret',{status:503}),()=>new Response('{',{headers:{'content-type':'application/json'}}),
  ()=>new Response('{}',{headers:{'content-type':'text/html'}}),
  nonce=>new Response(JSON.stringify({id_token:token({nonce,padding:'x'.repeat(3000)})}),{headers:{'content-type':'application/json'}})];
 for(const fixture of fixtures){
  let nonce;
  await withOidc(async()=>fixture(nonce),async base=>{
   const pending=await login(base);nonce=pending.nonce;
   const r=await fetch(base+'/auth/callback?code=a&state='+pending.state,{headers:{cookie:pending.cookie},redirect:'manual'});
   assert.equal(r.status,401);assert.doesNotMatch(r.headers.get('set-cookie'),/__Host-bff_session=/);
   assert.doesNotMatch(await r.text(),/provider|secret|id_token/);
  });
 }
});
test('logout requires a same-origin POST and clears the secure cookie',async()=>{
 await withOidc(async()=>{throw new Error('unexpected exchange');},async base=>{
  const get=await fetch(base+'/auth/logout',{redirect:'manual'});assert.equal(get.status,404);
  for(const headers of [{},{origin:'https://evil.example'},{origin:'https://app.example','sec-fetch-site':'cross-site'}]){
   const r=await fetch(base+'/auth/logout',{method:'POST',headers,redirect:'manual'});assert.equal(r.status,403);
   assert.equal(r.headers.get('set-cookie'),null);
  }
  const r=await fetch(base+'/auth/logout',{method:'POST',headers:{origin:'https://app.example'},redirect:'manual'});
  assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/');
  assert.match(r.headers.get('set-cookie'),/__Host-bff_session=; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=0/);
 });
});
test('duplicate session cookies, tampering and malformed Authorization do not authenticate',async()=>{
 await withOidc(async()=>{throw new Error('must not reach engine');},async base=>{
  const value=seal({token:token()},Buffer.alloc(32,7));
  for(const headers of [{cookie:'__Host-bff_session='+value+'; __Host-bff_session='+value},
   {cookie:'__Host-bff_session=corrupt'},{cookie:'__Host-bff_session='+value,authorization:'Basic malformed'}]){
   const r=await fetch(base+'/api/labels/label_0001/reports/streams',{headers});assert.equal(r.status,401);
  }
 });
});
test('session endpoint exposes only current label roles and no authentication secrets',async()=>{
 let calls=0;
 await withServer(async()=>{calls++;throw new Error('must not reach engine');},async base=>{
  const unauthenticated=await fetch(base+'/api/session');assert.equal(unauthenticated.status,401);
  const grants=[{labelId:'label_0001',active:true,role:'owner',expiresAtMs:1800000300000},
   {labelId:'label_0002',active:true,role:'owner',expiresAtMs:1800000300000}];
  const response=await fetch(base+'/api/session',{headers:{authorization:'Bearer '+token({labelGrants:grants,nonce:'private nonce'})}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{subject:'user_001',expiresAtMs:1800000300000,
   labels:[{labelId:'label_0001',role:'viewer',expiresAtMs:1800000060000}]});
  assert.equal(calls,0);
  const query=await fetch(base+'/api/session?labelId=label_0002');assert.equal(query.status,404);
 },{checkMembership:async(identity,labelId)=>labelId==='label_0001'?{...identity,
  labelGrants:[{labelId,active:true,role:'viewer',expiresAtMs:1800000060000}]}:null});
});
