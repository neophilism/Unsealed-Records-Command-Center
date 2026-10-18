import test from 'node:test';import assert from 'node:assert/strict';
import {projectSceneSignalAggregate,createSceneSignalRevisionGuard,projectSceneSignalSession} from './scenesignal.mjs';
const base={labelId:'label_0001',sessionId:'session_0001',eventId:'event_0001',startedAt:'2026-10-18T20:00:00Z',status:'running',attendance:'100',engagements:'20',commerceTransactions:'12',commerceMinor:'9007199254740993',currency:'USD',source:{system:'SceneSignal',kind:'live',revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',minimumGroupSize:10,nowMs:2000};
test('shows only thresholded aggregates with exact commerce values',()=>{
 const result=projectSceneSignalAggregate(base,options);
 assert.equal(result.attendance,'100');assert.equal(result.commerceMinor,'9007199254740993');
 assert.equal(result.participantIds,undefined);
 const small=projectSceneSignalAggregate({...base,attendance:'9',engagements:'2',commerceTransactions:'1'},options);
 assert.equal(small.attendance,null);assert.equal(small.commerceMinor,null);assert.equal(small.privacySuppressed,true);
});
test('rejects cross-label, exact location, participant IDs and future source',()=>{
 for(const value of [{...base,labelId:'label_0002'},{...base,exactLocation:'1,2'},
  {...base,participantIds:['p']},{...base,source:{...base.source,observedAtMs:33001}}])
  assert.throws(()=>projectSceneSignalAggregate(value,options));
});
test('session revisions cannot regress status or conflict at same version',()=>{
 const guard=createSceneSignalRevisionGuard();const first=projectSceneSignalAggregate(base,options);
 assert.equal(guard.accept(first),'accepted');assert.equal(guard.accept(first),'duplicate');
 assert.equal(guard.accept({...first,attendance:'99'}),'conflict');
 const regression=projectSceneSignalAggregate({...base,status:'planned',source:{...base.source,revision:2}},options);
 assert.equal(guard.accept(regression),'state_regression');
 const ended=projectSceneSignalAggregate({...base,status:'ended',source:{...base.source,revision:2}},options);
 assert.equal(guard.accept(ended),'accepted');assert.equal(guard.accept(first),'stale');
});
test('legacy projection remains compatible',()=>{
 const old={sourceVerified:true,labelAuthorized:true,sessionId:'session_0001',eventId:'event_0001',startedAt:'2026-10-18T20:00:00Z',status:'planned'};
 assert.equal(projectSceneSignalSession(old).status,'planned');
});
