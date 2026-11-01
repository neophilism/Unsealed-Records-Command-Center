import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTooLostLines} from '../src/toolost-lines.mjs';
import {renderTooLost} from '../src/toolost-view.mjs';
const lines=Array.from({length:120},(_,i)=>({lineId:'line_'+String(i).padStart(4,'0'),releaseId:i<60?'release_001':'release_002',trackId:'track_0001',kind:'royalty',units:'1',royaltyMinor:'1'}));
const row={provider:'TooLost',statementId:'statement_001',labelId:'label_0001',period:'2026-10',currency:'USD',royaltiesMinor:'120',lines,source:{system:'TooLost',kind:'live',revision:1,observedAtMs:1000,documentSha256:'a'.repeat(64)}};
test('statement line pages are bounded and do not change statement reconciliation totals',()=>{
 const first=selectTooLostLines(row);assert.equal(first.lines.length,50);assert.equal(first.pageCount,3);
 const last=selectTooLostLines(row,{page:99});assert.equal(last.page,2);assert.equal(last.lines.length,20);
 const html=renderTooLost(row,{requestedLabelId:'label_0001',nowMs:2000,currencyDigits:{USD:2},selection:{page:1}});
 assert.equal((html.match(/<details>/g)||[]).length,50);assert.match(html,/<strong>1.20<\/strong>/);
 assert.match(html,/Page 2 of 3/);assert.match(html,/statement total covers all lines/);
});
test('line search finds release/track/line ids without requesting another provider record',()=>{
 assert.equal(selectTooLostLines(row,{query:'release_002'}).totalMatches,60);
 assert.equal(selectTooLostLines(row,{query:'LINE_0001'}).totalMatches,1);
 assert.equal(selectTooLostLines(row,{kind:'reversal'}).totalMatches,0);
 const none=selectTooLostLines(row,{query:'not-present',page:5});assert.equal(none.page,0);assert.equal(none.lines.length,0);
});
test('line selectors reject unbounded pages, malformed filters and unsafe text controls',()=>{
 for(const selection of [{page:-1},{page:NaN},{pageSize:101},{pageSize:0},{query:'x'.repeat(129)},{query:'\n'},{kind:'other'}])
  assert.throws(()=>selectTooLostLines(row,selection));
});
