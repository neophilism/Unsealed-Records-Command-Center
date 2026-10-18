import test from 'node:test';import assert from 'node:assert/strict';
import {createTrackZeroClient} from './trackzero-client.mjs';
const event=(label,revision=1)=>({labelId:label,creatorId:'creator_01',artistId:'artist_001',occurrenceId:'occurrence_01',eventId:'event_0001',action:'earned',pointsMicro:'100',verified:true,evidenceVerified:true,eligiblePlayback:true,finalAnnouncementCompleted:true,source:{system:'TrackZero',kind:'live',revision,observedAtMs:1000}});
const json=(label,revision)=>new Response(JSON.stringify({labelId:label,creatorId:'creator_01',events:[event(label,revision)]}),{headers:{'content-type':'application/json'}});
test('same-origin contributor request passes no provider token or creator selector',async()=>{
 const client=createTrackZeroClient({creatorId:'creator_01',now:()=>2000,fetchImpl:async(url,options)=>{
  assert.equal(url,'/api/labels/label_0001/reports/trackzero');assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.authorization,undefined);return json('label_0001',1);
 }});
 assert.equal((await client.load('label_0001')).artists[0].earnedMicro,'100');
});
test('wrong contributor and old scope response are rejected',async()=>{
 const wrong=createTrackZeroClient({creatorId:'creator_02',now:()=>2000,fetchImpl:async()=>json('label_0001',1)});
 await assert.rejects(()=>wrong.load('label_0001'));
 let release;
 const client=createTrackZeroClient({creatorId:'creator_01',now:()=>2000,fetchImpl:async url=>url.includes('label_0001')?new Promise(resolve=>{release=()=>resolve(json('label_0001',1));}):json('label_0002',1)});
 const old=client.load('label_0001');assert.equal((await client.load('label_0002')).labelId,'label_0002');
 release();await assert.rejects(old,/superseded/);
});
