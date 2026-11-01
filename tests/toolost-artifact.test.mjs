import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTooLostArtifact} from '../src/toolost-artifact.mjs';
const bytes=new TextEncoder().encode('hello');
const row={provider:'TooLost',statementId:'statement_001',labelId:'label_0001',period:'2026-10',currency:'USD',royaltiesMinor:'20',lines:[{lineId:'line_0001',releaseId:'release_001',trackId:'track_0001',kind:'royalty',units:'1',royaltyMinor:'20'}],source:{system:'TooLost',kind:'live',revision:1,observedAtMs:1000,documentSha256:'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'}};
const options={requestedLabelId:'label_0001',nowMs:2000};
test('compares actual bytes against claimed SHA-256 without claiming provider authenticity',async()=>{
 const match=await compareTooLostArtifact(bytes,row,options);assert.equal(match.matches,true);assert.equal(match.byteLength,5);
 assert.equal(match.providerVerified,undefined);assert.equal(match.statementId,'statement_001');
 const mismatch=await compareTooLostArtifact(new TextEncoder().encode('different'),row,options);assert.equal(mismatch.matches,false);
});
test('artifact comparison binds label and statement metadata and enforces resource limits',async()=>{
 await assert.rejects(compareTooLostArtifact(bytes,row,{...options,requestedLabelId:'label_0002'}));
 await assert.rejects(compareTooLostArtifact(new Uint8Array(),row,options));
 await assert.rejects(compareTooLostArtifact(new Uint8Array(16000001),row,options));
 await assert.rejects(compareTooLostArtifact('hello',row,options));
});
