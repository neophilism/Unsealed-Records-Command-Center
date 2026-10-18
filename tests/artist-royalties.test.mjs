import test from 'node:test';import assert from 'node:assert/strict';
import {projectArtistPortfolio,summarizeArtistPortfolio,projectArtistRoyalty} from './artist.mjs';
const statement={statementId:'statement_001',labelId:'label_0001',releaseId:'release_001',period:'2026-10',currency:'USD',distributableMinor:'9007199254740994',allocations:[{artistId:'artist_001',splitBasisPoints:5000,amountMinor:'4503599627370497'},{artistId:'artist_002',splitBasisPoints:5000,amountMinor:'4503599627370497'}],source:{kind:'live',revision:1,observedAtMs:1000}};
const options={requestedArtistId:'artist_001',authorizedLabelIds:['label_0001'],nowMs:2000};
test('reconciles exact splits and only reveals requested artist',()=>{
 const result=projectArtistPortfolio({statements:[statement]},options);
 assert.equal(result.statements[0].amountMinor,'4503599627370497');
 assert.doesNotMatch(JSON.stringify(result),/artist_002/);
 assert.equal(summarizeArtistPortfolio(result)[0].totalMinor,'4503599627370497');
});
test('foreign label, invalid split and discrepant totals fail closed',()=>{
 for(const value of [{...statement,labelId:'label_0002'},
  {...statement,distributableMinor:'9007199254740995'},
  {...statement,allocations:[statement.allocations[0],{...statement.allocations[1],splitBasisPoints:4000}]}])
  assert.throws(()=>projectArtistPortfolio({statements:[value]},options));
});
test('negative adjustment stays exact and never implies spendable balance',()=>{
 const reversal={...statement,statementId:'statement_002',distributableMinor:'-10',allocations:[{artistId:'artist_001',splitBasisPoints:5000,amountMinor:'-5'},{artistId:'artist_002',splitBasisPoints:5000,amountMinor:'-5'}]};
 const result=projectArtistPortfolio({statements:[statement,reversal]},options);
 assert.equal(summarizeArtistPortfolio(result)[0].totalMinor,'4503599627370492');
});
test('legacy projection remains compatible',()=>{
 const row={artistAuthorized:true,sourceVerified:true,artistId:'artist_001',statementId:'statement_001',currency:'USD',amountMinor:'-1000',period:'2026-10'};
 assert.equal(projectArtistRoyalty(row).amountMinor,'-1000');
});
