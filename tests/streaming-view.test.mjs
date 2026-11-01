import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStreaming} from '../src/streaming-view.mjs';
const record={labelId:'label_0001',period:'2026-10',country:'US',platform:'spotify',streams:'9007199254740993',source:{system:'engine',kind:'live',revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',expectedSource:'engine',nowMs:2000,freshnessMs:10000};
test('streaming markup uses exact integer formatting, provenance and semantic table headings',()=>{
 const html=renderStreaming({labelId:'label_0001',records:[record]},options);
 assert.match(html,/9,007,199,254,740,993/);assert.match(html,/Live source/);assert.match(html,/<caption>/);
 assert.match(html,/scope="col">Observed/);assert.match(html,/revision 1/);
 assert.throws(()=>renderStreaming({labelId:'label_0002',records:[record]},options));
});
test('awaiting is unavailable rather than zero; mixed totals are withheld',()=>{
 const empty=renderStreaming({labelId:'label_0001',records:[]},options);
 assert.match(empty,/Awaiting source data/);assert.match(empty,/<strong>Unavailable<\/strong>/);
 const mixed=renderStreaming({labelId:'label_0001',records:[record,{...record,platform:'apple',source:{...record.source,kind:'synthetic'}}]},options);
 assert.match(mixed,/total withheld/);assert.match(mixed,/Synthetic demo/);
});
