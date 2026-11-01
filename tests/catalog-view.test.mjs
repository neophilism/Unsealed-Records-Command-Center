import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCatalog,createCatalogPresenter} from '../src/catalog-view.mjs';
import {createCatalogClient} from '../src/catalog-client.mjs';
const make=(labelId='label_0001')=>({labelId,releaseId:'release_001',title:'Album <script>alert(1)</script>',releaseDate:'2026-10-18',
 artworkUrl:'https://art.example/cover.jpg?q=" onerror="alert(1)',works:[{workId:'work_0001',title:'Work & composition'}],
 tracks:[{trackId:'track_0001',title:'<img onerror=alert(1)>',isrc:'USABC1234567',workIds:['work_0001']}],
 source:{system:'engine',status:'cached',revision:1,observedAtMs:1000}});
const options={requestedLabelId:'label_0001',expectedSource:'engine',artworkHosts:['art.example'],nowMs:2000};
test('semantic catalog markup escapes metadata and distinguishes cached and synthetic source states',()=>{
 const markup=renderCatalog(make(),options);
 assert.doesNotMatch(markup,/<script>|<img onerror=/);assert.match(markup,/&lt;script&gt;/);
 assert.match(markup,/scope="col">ISRC/);assert.match(markup,/<caption>/);assert.match(markup,/referrerpolicy="no-referrer"/);
 assert.match(markup,/Cached observation/);assert.match(markup,/Work &amp; composition/);assert.match(markup,/USABC1234567/);
 const synthetic=make();synthetic.source.status='synthetic';assert.match(renderCatalog(synthetic,options),/Synthetic demo/);
 assert.throws(()=>renderCatalog(make('label_0002'),options));
});
test('presenter clears prior label synchronously and never publishes superseded results',async()=>{
 let release;const states=[];
 const client=createCatalogClient({expectedSource:'engine',artworkHosts:['art.example'],now:()=>2000,
  fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify(make()),{headers:{'content-type':'application/json'}}));}):
   new Response(JSON.stringify(make('label_0002')),{headers:{'content-type':'application/json'}})});
 const presenter=createCatalogPresenter({client,onState:state=>states.push(state)});
 const first=presenter.select('label_0001');
 const second=presenter.select('label_0002');
 assert.equal(states.at(-1).status,'loading');assert.equal(states.at(-1).record,null);
 await second;release();await first;
 assert.deepEqual(states.filter(s=>s.status==='ready').map(s=>s.labelId),['label_0002']);
 presenter.dispose();assert.equal(states.at(-1).status,'cleared');assert.equal(states.at(-1).record,null);
});
test('presenter clears stale data on failures and prevents publication after disposal',async()=>{
 const states=[];let release;
 const presenter=createCatalogPresenter({client:{load:()=>new Promise(resolve=>{release=resolve;}),cancel(){}},onState:s=>states.push(s)});
 const request=presenter.select('label_0001');presenter.dispose();release(make());await request;
 assert.equal(states.some(s=>s.status==='ready'),false);assert.equal(states.at(-1).record,null);
 const failed=createCatalogPresenter({client:{load:async()=>{throw new Error('private detail');},cancel(){}},onState:s=>states.push(s)});
 await failed.select('label_0001');assert.deepEqual(states.at(-1),{status:'unavailable',labelId:'label_0001',record:null});
});
