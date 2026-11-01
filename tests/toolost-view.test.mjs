import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTooLost} from '../src/toolost-view.mjs';
const row={provider:'TooLost',statementId:'statement_001',labelId:'label_0001',period:'2026-10',currency:'USD',royaltiesMinor:'9007199254740990',lines:[{lineId:'line_0001',releaseId:'release_001',trackId:'track_0001',kind:'royalty',units:'1',royaltyMinor:'9007199254740993'},{lineId:'line_0002',releaseId:'release_001',trackId:'track_0001',kind:'reversal',units:'1',royaltyMinor:'-3'}],source:{system:'TooLost',kind:'live',revision:1,observedAtMs:1000,documentSha256:'a'.repeat(64)}};
const options={requestedLabelId:'label_0001',nowMs:2000,currencyDigits:{USD:2}};
test('statement view renders exact totals, signed lines and accessible native drill-down',()=>{
 const html=renderTooLost(row,options);assert.match(html,/90,071,992,547,409.90/);assert.match(html,/-0.03/);
 assert.match(html,/<details><summary>/);assert.match(html,/<caption>/);assert.match(html,/track_0001/);
 assert.match(html,/document is not uploaded/);assert.doesNotMatch(html,/provider verified/i);
 assert.throws(()=>renderTooLost(row,{...options,requestedLabelId:'label_0002'}));
});
test('synthetic statements are visibly marked and unknown currency formats remain unavailable',()=>{
 assert.match(renderTooLost({...row,source:{...row.source,kind:'synthetic'}},options),/Synthetic demo/);
 assert.match(renderTooLost(row,{...options,currencyDigits:{}}),/Unavailable/);
});
