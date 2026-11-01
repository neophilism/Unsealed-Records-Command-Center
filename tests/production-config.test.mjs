import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateProductionConfig} from '../scripts/production-config.mjs';
const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const publicJwk={...publicKey.export({format:'jwk'}),kid:'key1',alg:'RS256',use:'sig'};
const nowMs=1800000000000;
const membership=()=>({version:1,revision:1,issuer:'https://id.example',issuedAtMs:nowMs,validUntilMs:nowMs+60000,grants:[]});
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'urc-deploy-')),path=join(dir,'membership.json');
 await writeFile(path,JSON.stringify(membership()),{mode:0o600});
 const env={APP_ORIGIN:'https://app.example',BFF_ISSUER:'https://id.example',BFF_AUDIENCE:'dashboard',
  ENGINE_ORIGIN:'https://engine.example',ENGINE_TOKEN:'private-engine-fixture',
  OIDC_AUTHORIZATION_ENDPOINT:'https://id.example/authorize',OIDC_TOKEN_ENDPOINT:'https://id.example/token',
  OIDC_REDIRECT_URI:'https://app.example/auth/callback',OIDC_CLIENT_ID:'client',
  BFF_SESSION_KEY_BASE64:Buffer.alloc(32,7).toString('base64'),BFF_JWKS_JSON:JSON.stringify({keys:[publicJwk]}),
  BFF_REPORT_ROUTES_JSON:JSON.stringify({streams:'/v1/labels/{labelId}/reports/streams'}),BFF_MEMBERSHIP_FILE:path};
 try{await fn(env,path);}finally{await rm(dir,{recursive:true,force:true});}
}
test('preflight accepts complete server-only config and returns no credentials or identifiers',async()=>{
 await fixture(async env=>assert.deepEqual(await validateProductionConfig(env,{nowMs}),{valid:true,port:3000}));
});
test('missing settings, insecure URLs, cross-origin callbacks, malformed keys and ports fail',async()=>{
 await fixture(async env=>{
  for(const key of Object.keys(env)){
   const incomplete={...env};delete incomplete[key];await assert.rejects(validateProductionConfig(incomplete,{nowMs}),/Invalid configuration/);
  }
  for(const patch of [{ENGINE_ORIGIN:'http://engine.example'},{APP_ORIGIN:'https://app.example/?token=private'},
   {OIDC_REDIRECT_URI:'https://other.example/auth/callback'},{OIDC_REDIRECT_URI:'https://app.example/other'},
   {BFF_SESSION_KEY_BASE64:env.BFF_SESSION_KEY_BASE64+'garbage'}, {PORT:'0'},{PORT:'65536'},{PORT:'3.5'},
   {ENGINE_TOKEN:'private\nheader'},{BFF_JWKS_JSON:'{}'},{BFF_REPORT_ROUTES_JSON:'[]'},
   {BFF_REPORT_ROUTES_JSON:JSON.stringify({streams:'https://other.example'})}])
   await assert.rejects(validateProductionConfig({...env,...patch},{nowMs}),/Invalid configuration/);
 });
});
test('preflight rejects private signing material, ambiguous key ids and weak RSA keys',async()=>{
 await fixture(async env=>{
  const weak=generateKeyPairSync('rsa',{modulusLength:1024}).publicKey.export({format:'jwk'});
  for(const keys of [[{...publicJwk,d:'private'}],[publicJwk,publicJwk],[{...publicJwk,...weak}]]){
   const result=validateProductionConfig({...env,BFF_JWKS_JSON:JSON.stringify({keys})},{nowMs});
   await assert.rejects(result,/Invalid configuration: BFF_JWKS_JSON/);
  }
 });
});
test('missing, public, stale and wrong-issuer membership files fail preflight',async()=>{
 await fixture(async(env,path)=>{
  for(const document of [{...membership(),issuer:'other'},{...membership(),validUntilMs:nowMs},
   {...membership(),issuedAtMs:nowMs+1},{...membership(),validUntilMs:nowMs+86400001}]){
   await writeFile(path,JSON.stringify(document));await assert.rejects(validateProductionConfig(env,{nowMs}),/BFF_MEMBERSHIP_FILE/);
  }
  await writeFile(path,JSON.stringify(membership()));await chmod(path,0o644);
  await assert.rejects(validateProductionConfig(env,{nowMs}),/BFF_MEMBERSHIP_FILE/);
  await rm(path);await assert.rejects(validateProductionConfig(env,{nowMs}),/BFF_MEMBERSHIP_FILE/);
 });
});
test('production entry never logs secret values when configuration is missing',()=>{
 const result=spawnSync(process.execPath,['scripts/start-production.mjs'],{encoding:'utf8',
  env:{ENGINE_TOKEN:'DO-NOT-LOG-private-fixture'},timeout:5000});
 assert.equal(result.status,1);assert.equal(result.stdout,'');
 assert.equal(result.stderr,'Production startup refused; verify server configuration and application artifact.\n');
 assert.doesNotMatch(result.stderr,/DO-NOT-LOG|ENGINE_TOKEN/);
});
test('production entry fails closed when valid configuration has no application artifact',async()=>{
 await fixture(async(env,path)=>{
  const current=Date.now();await writeFile(path,JSON.stringify({...membership(),issuedAtMs:current,validUntilMs:current+60000}));
  const result=spawnSync(process.execPath,['scripts/start-production.mjs'],{encoding:'utf8',env,timeout:5000});
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  assert.equal(result.stderr,'Production startup refused; verify server configuration and application artifact.\n');
 });
});
