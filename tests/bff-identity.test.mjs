import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyIdentity} from '../src/bff/identity.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const key={...publicKey.export({format:'jwk'}),kid:'key1',use:'sig',alg:'RS256'};
const nowMs=1800000000000;
const options={issuer:'issuer',audience:'dashboard',jwks:{keys:[key]},nowMs};
const claims={iss:'issuer',aud:'dashboard',sub:'user_001',iat:1800000000,exp:1800000300,labelGrants:[]};
function jwt(body=claims,header={alg:'RS256',typ:'JWT',kid:'key1'},signer=privateKey){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=enc(header)+'.'+enc(body);return input+'.'+sign('RSA-SHA256',Buffer.from(input),signer).toString('base64url');
}
test('identity requires pinned issuer, audience, signing key and supported JWT headers',()=>{
 assert.equal(verifyIdentity(jwt(),options).subject,'user_001');
 for(const header of [{alg:'none',typ:'JWT',kid:'key1'},{alg:'HS256',typ:'JWT',kid:'key1'},
  {alg:'RS256',typ:'JWT',kid:'unknown'},{alg:'RS256',typ:'JWT',kid:'key1',crit:['custom']},
  {alg:'RS256',typ:'JWT',kid:'key1',b64:false}]) assert.equal(verifyIdentity(jwt(claims,header),options),null);
 const other=generateKeyPairSync('rsa',{modulusLength:2048});assert.equal(verifyIdentity(jwt(claims,undefined,other.privateKey),options),null);
 assert.equal(verifyIdentity(jwt(),{...options,jwks:{keys:[key,key]}}),null);
 for(const c of [{iss:'other'},{aud:'other'},{sub:'bad subject'}]) assert.equal(verifyIdentity(jwt({...claims,...c}),options),null);
});
test('identity rejects invalid lifetimes, future activation, invalid clock and malformed tokens',()=>{
 for(const c of [{exp:1800000000},{exp:1800000301},{iat:1800000031},{iat:-1},
  {iat:1800000030,exp:1800000029},{nbf:1800000001},{exp:'1800000300'},{labelGrants:{}}])
  assert.equal(verifyIdentity(jwt({...claims,...c}),options),null);
 for(const nowMs of [NaN,Infinity,-1,1800000000000.5]) assert.equal(verifyIdentity(jwt(),{...options,nowMs}),null);
 for(const value of ['',null,'a.b.c','a..c','x'.repeat(16385),jwt()+'.extra']) assert.equal(verifyIdentity(value,options),null);
});
