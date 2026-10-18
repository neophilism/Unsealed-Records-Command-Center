import test from 'node:test';import assert from 'node:assert/strict';
import {createArtistClient} from './artist-client.mjs';
const projected=(label,revision=1)=>({artistId:'artist_001',statements:[{statementId:'statement_001',labelId:label,releaseId:'release_001',period:'2026-10',currency:'USD',amountMinor:'100',splitBasisPoints:5000,source:{kind:'live',revision,observedAtMs:1000}}]});
const json=(label,revision)=>new Response(JSON.stringify(projected(label,revision)),{headers:{'content-type':'application/json'}});
test('same-origin artist view contains only current artist projection',async()=>{
 const client=createArtistClient({artistId:'artist_001',authorizedLabelIds:['label_0001'],fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/artist');assert.equal(options.credentials,'same-origin');return json('label_0001',1);
 }});
 const value=await client.load('label_0001');assert.equal(value.totals[0].totalMinor,'100');
 assert.doesNotMatch(JSON.stringify(value),/artist_002/);
});
test('raw allocations and foreign labels are rejected',async()=>{
 const raw=projected('label_0001');raw.statements[0].allocations=[{artistId:'artist_002',amountMinor:'100'}];
 const client=createArtistClient({artistId:'artist_001',authorizedLabelIds:['label_0001'],fetchImpl:async()=>new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}})});
 await assert.rejects(()=>client.load('label_0001'));
 await assert.rejects(()=>client.load('label_0002'));
});
test('scope switch and older revisions fail closed',async()=>{
 let release;const client=createArtistClient({artistId:'artist_001',authorizedLabelIds:['label_0001','label_0002'],fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).artistId,'artist_001');release();await assert.rejects(old,/superseded/);
 let revision=2;const next=createArtistClient({artistId:'artist_001',authorizedLabelIds:['label_0001'],fetchImpl:async()=>json('label_0001',revision)});
 await next.load('label_0001');revision=1;await assert.rejects(()=>next.load('label_0001'),/Stale portfolio statement/);
});
