import test from 'node:test';import assert from 'node:assert/strict';
import {projectStreamingRecord,selectStreamingRecords,projectStreamingSnapshot} from '../src/streaming-insights.mjs';
const base={labelId:'label_0001',period:'2026-10',country:'US',platform:'spotify',streams:'9007199254740993',source:{system:'engine',kind:'live',revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',expectedSource:'engine',nowMs:2000,freshnessMs:10000};
test('retains exact huge counts and filters period, country and platform',()=>{
 const records=[base,{...base,period:'2026-09',streams:'7'}, {...base,country:'GB',streams:'3'}, {...base,platform:'apple',streams:'4'}];
 const result=selectStreamingRecords(records,{...options,period:'2026-10',country:'US',platform:'spotify'});
 assert.equal(result.totalStreams,'9007199254740993');assert.equal(result.records.length,1);
 const all=selectStreamingRecords(records,options);assert.equal(all.totalStreams,'9007199254741007');
 const missing=selectStreamingRecords(records,{...options,period:'2025-01'});assert.equal(missing.totalStreams,null);assert.equal(missing.availability,'awaiting');
});
test('newer revision replaces old and conflicting duplicate revision is denied',()=>{
 const newer={...base,streams:'8',source:{...base.source,revision:2}};
 assert.equal(selectStreamingRecords([base,newer],options).totalStreams,'8');
 assert.throws(()=>selectStreamingRecords([base,{...base,streams:'9'}],options));
});
test('wrong label, future source, malformed count and date fail closed',()=>{
 const bad=[{...base,labelId:'label_0002'},{...base,streams:'1e8'},
  {...base,period:'2026-13'},{...base,source:{...base.source,observedAtMs:33001}}];
 for(const x of bad) assert.throws(()=>projectStreamingRecord(x,options));
});
test('synthetic remains synthetic; old observed live data is cached',()=>{
 assert.equal(projectStreamingRecord({...base,source:{...base.source,kind:'synthetic'}},options).state,'synthetic');
 assert.equal(projectStreamingRecord(base,{...options,nowMs:20000}).state,'cached');
});
test('legacy projection stays compatible',()=>{
 const old={authorized:true,sourceVerified:true,labelId:'label_0001',period:'2026-10',streams:'9007199254740993',observedAt:'2026-10-18T00:00:00Z'};
 assert.equal(projectStreamingSnapshot(old).streams,old.streams);
 assert.throws(()=>projectStreamingSnapshot({...old,authorized:false}));
});
test('ALL-country summaries are not added to their component country rows',()=>{
 const all={...base,country:'ALL',streams:'100'};
 assert.equal(selectStreamingRecords([all,{...base,streams:'40'},{...base,country:'GB',streams:'60'}],options).totalStreams,'100');
 assert.equal(selectStreamingRecords([all,{...base,streams:'40'}],{...options,country:'US'}).totalStreams,'40');
});
test('mixed synthetic and observed counts never produce a combined business total',()=>{
 const result=selectStreamingRecords([base,{...base,platform:'apple',source:{...base.source,kind:'synthetic'}}],options);
 assert.equal(result.availability,'mixed');assert.equal(result.totalStreams,null);
 assert.throws(()=>selectStreamingRecords([],{...options,requestedLabelId:'bad'}));
 assert.throws(()=>selectStreamingRecords([],{...options,nowMs:NaN}));
});
test('synthetic revisions and ALL rows cannot replace observed data',()=>{
 const synthetic={...base,streams:'1000000',source:{...base.source,kind:'synthetic',revision:99}};
 const same=selectStreamingRecords([base,synthetic],options);
 assert.equal(same.records.length,2);assert.equal(same.availability,'mixed');assert.equal(same.totalStreams,null);
 const all=selectStreamingRecords([base,{...synthetic,country:'ALL'}],options);
 assert.equal(all.records.length,2);assert.equal(all.availability,'mixed');
});
