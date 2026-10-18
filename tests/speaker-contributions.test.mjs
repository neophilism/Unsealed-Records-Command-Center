import test from 'node:test';import assert from 'node:assert/strict';
import {projectTrackZeroEvent,summarizeTrackZeroEvents,projectContribution} from './trackzero.mjs';
const base={labelId:'label_0001',creatorId:'creator_01',artistId:'artist_001',occurrenceId:'occurrence_01',eventId:'event_0001',action:'earned',pointsMicro:'9007199254740993',verified:true,evidenceVerified:true,eligiblePlayback:true,finalAnnouncementCompleted:true,source:{system:'TrackZero',kind:'live',revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',requestedCreatorId:'creator_01',nowMs:2000};
test('points remain exact and separated by artist',()=>{
 const others={...base,artistId:'artist_002',eventId:'event_0002',pointsMicro:'7'};
 const spent={...base,eventId:'event_0003',action:'spent',pointsMicro:'3',redemptionConfirmed:true};
 const result=summarizeTrackZeroEvents([base,others,spent],options);
 assert.equal(result.artists[0].earnedMicro,'9007199254740993');assert.equal(result.artists[0].spentMicro,'3');
 assert.equal(result.artists[1].earnedMicro,'7');
});
test('cross-label, provisional and duplicate occurrence contributions fail',()=>{
 const invalid=[{...base,labelId:'label_0002'},{...base,verified:false},
  {...base,finalAnnouncementCompleted:false},{...base,pointsMicro:'1.1'}];
 for(const event of invalid) assert.throws(()=>projectTrackZeroEvent(event,options));
 assert.throws(()=>summarizeTrackZeroEvents([base,{...base,eventId:'event_0002'}],options));
});
test('conflicting event replay and unconfirmed spend fail',()=>{
 assert.throws(()=>summarizeTrackZeroEvents([base,{...base,pointsMicro:'2'}],options));
 assert.throws(()=>projectTrackZeroEvent({...base,action:'spent'},options));
});
test('legacy contribution remains compatible',()=>{
 const legacy={verified:true,labelAuthorized:true,creatorId:'creator_01',occurrenceId:'occurrence_01',pointsMicro:'10000000',finalAnnouncementCompleted:true,eligiblePlayback:true,evidenceVerified:true};
 assert.equal(projectContribution(legacy).pointsMicro,'10000000');
});
