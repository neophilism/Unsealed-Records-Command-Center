import test from 'node:test';import assert from 'node:assert/strict';
import {projectLabelCatalog,createCatalogRevisionGuard,projectLabelRelease,groupAuthorizedCatalog} from './catalog.mjs';
const valid={labelId:'label_0001',releaseId:'release_001',title:'First Album',releaseDate:'2026-10-18',artworkUrl:'https://art.example/cover.jpg',works:[{workId:'work_0001',title:'Composition'}],tracks:[{trackId:'track_0001',title:'First Song',isrc:'USABC1234567',workIds:['work_0001']}],source:{system:'engine',revision:3,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',expectedSource:'engine',artworkHosts:['art.example'],nowMs:2000};
test('projects requested label catalog with track ISRC and source provenance',()=>{
 const result=projectLabelCatalog(valid,options);assert.equal(result.tracks[0].isrc,'USABC1234567');assert.deepEqual(result.tracks[0].workIds,['work_0001']);assert.equal(result.source.revision,3);assert.ok(Object.isFrozen(result.tracks));
});
test('rejects wrong tenant, malformed ISRC, duplicate track, unsafe artwork and future source',()=>{
 const bad=[
  {...valid,labelId:'label_0002'},
  {...valid,tracks:[{...valid.tracks[0],isrc:'BAD'}]},
  {...valid,tracks:[valid.tracks[0],valid.tracks[0]]},
  {...valid,tracks:[{...valid.tracks[0],workIds:['unknown_001']}]},
  {...valid,releaseDate:'2026-02-30'},
  {...valid,artworkUrl:'http://art.example/cover.jpg'},
  {...valid,artworkUrl:'https://other.example/cover.jpg'},
  {...valid,source:{...valid.source,system:'untrusted'}},
  {...valid,source:{...valid.source,observedAtMs:40000}}
 ];
 for(const value of bad) assert.throws(()=>projectLabelCatalog(value,options));
});
test('groups only authorized owning labels and rejects duplicate releases',()=>{
 const one=projectLabelCatalog(valid,options);
 const two=projectLabelCatalog({...valid,labelId:'label_0002'}, {...options,requestedLabelId:'label_0002'});
 const grouped=groupAuthorizedCatalog([one,two],['label_0001','label_0002']);
 assert.deepEqual(grouped.map(x=>x.labelId),['label_0001','label_0002']);
 assert.throws(()=>groupAuthorizedCatalog([one,two],['label_0001']));
 assert.throws(()=>groupAuthorizedCatalog([one,one],['label_0001']));
});
test('late and repeated snapshots cannot replace newer revision, independently per label',()=>{
 const guard=createCatalogRevisionGuard();
 const current=projectLabelCatalog(valid,options);
 assert.equal(guard.accept(current),true);assert.equal(guard.accept(current),false);
 const old=projectLabelCatalog({...valid,source:{...valid.source,revision:2}},options);
 assert.equal(guard.accept(old),false);
 const other=projectLabelCatalog({...valid,labelId:'label_0002'}, {...options,requestedLabelId:'label_0002'});
 assert.equal(guard.accept(other),true);
});
test('legacy release projection still validates flags and ISRC',()=>{
 const old={labelId:'label_0001',releaseId:'release_001',title:'Old',isrc:'USABC1234567',labelVerified:true,sourceVerified:true};
 assert.equal(projectLabelRelease(old).isrc,'USABC1234567');
 assert.throws(()=>projectLabelRelease({...old,labelVerified:false}));
});
