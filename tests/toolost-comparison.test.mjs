import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentComparison} from '../src/toolost-comparison.mjs';
const bytes=new TextEncoder().encode('hello');
const row={provider:'TooLost',statementId:'statement_001',labelId:'label_0001',period:'2026-10',currency:'USD',royaltiesMinor:'20',lines:[{lineId:'line_0001',releaseId:'release_001',trackId:'track_0001',kind:'royalty',units:'1',royaltyMinor:'20'}],source:{system:'TooLost',kind:'live',revision:1,observedAtMs:1000,documentSha256:'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'}};
const options={requestedLabelId:'label_0001'};
test('a later selected document wins over a delayed earlier file read',async()=>{
 const states=[];let release;
 const controller=createDocumentComparison({now:()=>2000,onState:s=>states.push(s)});
 const old=controller.compare({size:5,arrayBuffer:()=>new Promise(resolve=>{release=()=>resolve(bytes.buffer);})},row,options);
 await controller.compare(new File(['different'],'second.pdf'),row,options);
 assert.equal(states.at(-1).result.matches,false);
 release();await old;assert.equal(states.at(-1).result.matches,false);assert.equal(states.filter(s=>s.status==='compared').length,1);
});
test('changing statement or disposing clears any previous and pending document evidence',async()=>{
 const states=[];let release;
 const controller=createDocumentComparison({now:()=>2000,onState:s=>states.push(s)});
 await controller.compare(new File([bytes],'first.pdf'),row,options);assert.equal(states.at(-1).result.matches,true);
 const pending=controller.compare({size:5,arrayBuffer:()=>new Promise(resolve=>{release=resolve;})},row,options);
 controller.clear();release(bytes.buffer);await pending;
 assert.deepEqual(states.at(-1),{status:'cleared',result:null});
});
test('oversized and invalid file contents cannot allocate unbounded comparison buffers or publish errors',async()=>{
 const states=[];const controller=createDocumentComparison({now:()=>2000,onState:s=>states.push(s)});
 for(const file of [{size:16000001,arrayBuffer:()=>{throw new Error('must not read');}},
  {size:5,arrayBuffer:async()=>999999999},{size:5,arrayBuffer:async()=>{throw new Error('private filename');}}]){
  await controller.compare(file,row,options);assert.deepEqual(states.at(-1),{status:'unavailable',result:null});
 }
});
