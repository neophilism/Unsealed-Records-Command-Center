import test from 'node:test';import assert from 'node:assert/strict';
import {projectTooLostDetail,selectTooLostLine,projectTooLostStatement} from '../src/toolost-statement.mjs';
const line=(lineId,kind,royaltyMinor)=>({lineId,releaseId:'release_001',trackId:'track_0001',kind,units:'2',royaltyMinor});
const base={provider:'TooLost',statementId:'statement_001',labelId:'label_0001',period:'2026-10',currency:'USD',royaltiesMinor:'9007199254740990',lines:[line('line_0001','royalty','9007199254740993'),line('line_0002','reversal','-3')],source:{system:'TooLost',kind:'live',revision:1,observedAtMs:1000,documentSha256:'a'.repeat(64)}};
const options={requestedLabelId:'label_0001',nowMs:2000};
test('reconciles exact statement total and exposes line drill-down',()=>{
 const statement=projectTooLostDetail(base,options);
 assert.equal(statement.royaltiesMinor,'9007199254740990');
 assert.equal(selectTooLostLine(statement,'line_0002').royaltyMinor,'-3');
});
test('wrong label, duplicate line, invalid source and mismatch fail closed',()=>{
 const bad=[{...base,labelId:'label_0002'},
  {...base,lines:[base.lines[0],base.lines[0]]},
  {...base,source:{...base.source,documentSha256:'wrong'}},
  {...base,royaltiesMinor:'9007199254740991'},
  {...base,lines:[line('line_0001','reversal','3'),base.lines[1]]}];
 for(const row of bad) assert.throws(()=>projectTooLostDetail(row,options));
 assert.throws(()=>selectTooLostLine(projectTooLostDetail(base,options),'line_9999'));
});
test('synthetic statements remain identified as synthetic',()=>{
 const value=projectTooLostDetail({...base,source:{...base.source,kind:'synthetic'}},options);
 assert.equal(value.source.kind,'synthetic');
});
test('legacy projection remains compatible',()=>{
 const row={provider:'TooLost',labelAuthorized:true,sourceVerified:true,statementId:'statement_001',labelId:'label_0001',period:'2026-10',currency:'USD',royaltiesMinor:'9007199254740993'};
 assert.equal(projectTooLostStatement(row).royaltiesMinor,row.royaltiesMinor);
});
test('typed and nested ownership metadata fail closed; source projection drops unknown secrets',()=>{
 for(const patch of [{statementId:12345678},{currency:['USD']},
  {lines:[{...base.lines[0],labelId:'label_0002'},base.lines[1]]},
  {lines:[{...base.lines[0],statementId:'statement_002'},base.lines[1]]},
  {lines:[{...base.lines[0],currency:'EUR'},base.lines[1]]}]) assert.throws(()=>projectTooLostDetail({...base,...patch},options));
 const projected=projectTooLostDetail({...base,source:{...base.source,engineToken:'private-fixture',debug:{secret:'fixture'}}},options);
 assert.equal(projected.source.engineToken,undefined);assert.equal(projected.source.debug,undefined);
 assert.throws(()=>projectTooLostDetail(base,{...options,nowMs:NaN}));
});
