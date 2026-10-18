import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDrilldown} from '../src/drilldown-provenance.mjs';
const identity={labels:['label_1'],roles:['view']};
const event={labelId:'label_1',resourceId:'release_1',eventId:'event_1',sourceId:'engine_1',sourceRevision:'rev_1',observedAt:'2026-10-18T00:00:00.000Z',kind:'stream',summary:'100 plays'};
const input={identity,labelId:'label_1',resourceId:'release_1',sourceStatus:'cached',events:[event]};
test('projects source-bound event provenance',()=>{const v=projectDrilldown(input);assert.equal(v.sourceStatus,'cached');assert.equal(v.events[0].sourceRevision,'rev_1');assert.equal(v.events[0].summary,'100 plays');});
test('rejects wrong tenant and resource',()=>{assert.throws(()=>projectDrilldown({...input,labelId:'label_2'}));assert.throws(()=>projectDrilldown({...input,events:[{...event,labelId:'label_2'}]}));assert.throws(()=>projectDrilldown({...input,events:[{...event,resourceId:'release_2'}]}));});
test('rejects invalid provenance, duplicate and overlarge pages',()=>{for(const events of [[{...event,sourceRevision:''}],[{...event,observedAt:'yesterday'}],[event,event]])assert.throws(()=>projectDrilldown({...input,events}));assert.throws(()=>projectDrilldown({...input,limit:0}));assert.throws(()=>projectDrilldown({...input,sourceStatus:'unknown'}));});
