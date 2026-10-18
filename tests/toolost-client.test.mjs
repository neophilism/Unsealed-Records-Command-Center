import test from 'node:test';import assert from 'node:assert/strict';
import {createTooLostClient} from './toolost-client.mjs';
const statement=(label,revision=1)=>({provider:'TooLost',statementId:'statement_001',labelId:label,period:'2026-10',currency:'USD',royaltiesMinor:'20',lines:[{lineId:'line_0001',releaseId:'release_001',trackId:'track_0001',kind:'royalty',units:'1',royaltyMinor:'20'}],source:{system:'TooLost',kind:'live',revision,observedAtMs:1000,documentSha256:'a'.repeat(64)}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,statements:[statement(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin statement request carries no provider key and validates label',async()=>{
 const client=createTooLostClient({now:()=>2000,fetchImpl:async(url,opts)=>{
  assert.equal(url,'/api/labels/label_0001/reports/toolost');assert.equal(opts.credentials,'same-origin');assert.equal(opts.headers.authorization,undefined);return json('label_0001',1);
 }});
 assert.equal((await client.load('label_0001','statement_001')).royaltiesMinor,'20');
 const wrong=createTooLostClient({now:()=>2000,fetchImpl:async()=>json('label_0002',1)});
 await assert.rejects(()=>wrong.load('label_0001','statement_001'));
});
test('scope switch discards old statement and later revision cannot regress',async()=>{
 let release;
 const client=createTooLostClient({now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001','statement_001');assert.equal((await client.load('label_0002','statement_001')).labelId,'label_0002');
 release();await assert.rejects(old,/superseded/);
 let revision=2;
 const next=createTooLostClient({now:()=>2000,fetchImpl:async()=>json('label_0001',revision)});
 await next.load('label_0001','statement_001');revision=1;
 await assert.rejects(()=>next.load('label_0001','statement_001'),/Stale statement revision/);
});
