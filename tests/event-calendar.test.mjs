import test from 'node:test';import assert from 'node:assert/strict';
import {projectCalendarEvent,listCalendarEvents,createQrIssuer,projectPublicEvent} from './event.mjs';
const base={labelId:'label_0001',ownerVerified:true,publishApproved:true,eventId:'event_0001',title:'Street launch',startsAt:'2026-10-19T10:00:00Z',endsAt:'2026-10-19T12:00:00Z',status:'scheduled',publicUrl:'https://events.example/e/1',source:{revision:1,observedAtMs:1000}};
const options={requestedLabelId:'label_0001',allowedHosts:['events.example'],nowMs:2000};
test('calendar keeps only approved public fields and newest event revision',()=>{
 const event=projectCalendarEvent(base,options);assert.equal(event.publicUrl,'https://events.example/e/1');assert.equal(event.privateAttendees,undefined);
 const cancelled={...base,status:'cancelled',source:{revision:2,observedAtMs:1500}};
 assert.equal(listCalendarEvents([base,cancelled],options)[0].status,'cancelled');
});
test('wrong label, unsafe destination, private attendee data and conflicting revision fail',()=>{
 for(const value of [{...base,labelId:'label_0002'},{...base,publicUrl:'https://evil.example/e'},
  {...base,privateAttendees:['person']},{...base,publicUrl:'https://events.example/e?token=secret'}])
  assert.throws(()=>projectCalendarEvent(value,options));
 assert.throws(()=>listCalendarEvents([base,{...base,title:'Other'}],options));
});
test('QR campaign tokens are signed, scoped and expire without personal data',()=>{
 let time=2000;const issuer=createQrIssuer({secret:Buffer.alloc(32,7),origin:'https://events.example/',now:()=>time});
 const url=issuer.issue({labelId:'label_0001',eventId:'event_0001',campaignId:'campaign_1',expiresAtMs:5000});
 const token=new URL(url).pathname.slice(3);const claims=issuer.verify(token);
 assert.deepEqual(claims,{labelId:'label_0001',eventId:'event_0001',campaignId:'campaign_1'});
 assert.doesNotMatch(url,/attendee|email|location/);
 assert.equal(issuer.verify(token.replace(/.$/,'A')),null);
 time=5000;assert.equal(issuer.verify(token),null);
});
test('legacy public event projection remains compatible',()=>{
 assert.equal(projectPublicEvent(base).eventId,'event_0001');
});
