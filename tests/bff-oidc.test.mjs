import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cookieValue,seal,unseal,oidcLogin,validOidcConfig} from '../src/bff/oidc.mjs';
const key=Buffer.alloc(32,7);
const config={authorizationEndpoint:'https://id.example/authorize',tokenEndpoint:'https://id.example/token',
 redirectUri:'https://app.example/auth/callback',clientId:'test-client'};
test('pending login binds fresh state, nonce, verifier and S256 challenge',()=>{
 const first=oidcLogin(config,key,1800000000000),second=oidcLogin(config,key,1800000000000);
 const pending=unseal(first.pending,key),url=new URL(first.url);
 assert.equal(url.searchParams.get('state'),pending.state);assert.equal(url.searchParams.get('nonce'),pending.nonce);
 assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(pending.verifier).digest('base64url'));
 assert.equal(url.searchParams.get('redirect_uri'),config.redirectUri);assert.notEqual(first.pending,second.pending);
 assert.notEqual(url.searchParams.get('state'),new URL(second.url).searchParams.get('state'));
});
test('sealed state rejects corruption, wrong key, oversize, non-base64url and duplicate cookies',()=>{
 const value=seal({token:'private fixture'},key);assert.deepEqual(unseal(value,key),{token:'private fixture'});
 assert.equal(unseal(value,Buffer.alloc(32,8)),null);
 const raw=Buffer.from(value,'base64url');raw[raw.length-1]^=1;
 assert.equal(unseal(raw.toString('base64url'),key),null);
 for(const v of [value+'=',value+'\n','x'.repeat(4001),null,'short']) assert.equal(unseal(v,key),null);
 assert.equal(cookieValue('a=1; __Host-bff_session=abc','__Host-bff_session'),'abc');
 assert.equal(cookieValue('__Host-bff_session=abc; __Host-bff_session=other','__Host-bff_session'),null);
});
test('OIDC deployment config forbids insecure endpoints and ambiguous redirect URIs',()=>{
 assert.equal(validOidcConfig(config),true);
 for(const c of [{authorizationEndpoint:'http://id.example/authorize'},{tokenEndpoint:'https://user:password@id.example/token'},
  {authorizationEndpoint:'https://id.example/authorize#fragment'},{tokenEndpoint:'https://id.example/token#fragment'},
  {redirectUri:'https://evil@app.example/auth/callback'},{redirectUri:'https://app.example/auth/callback?x=1'},
  {redirectUri:'https://app.example/auth/callback#fragment'},{redirectUri:'https://app.example/other'}, {clientId:''}])
  assert.equal(validOidcConfig({...config,...c}),false);
});
