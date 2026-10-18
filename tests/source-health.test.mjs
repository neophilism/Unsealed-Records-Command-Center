import test from 'node:test';import assert from 'node:assert/strict';
import {projectSourceObservation,createAlertEvaluator,assessSourceHealth,evaluateGoal} from './health.mjs';
const base={labelId:'label_0001',sourceId:'streaming',metricId:'streams',accessVerified:true,kind:'live',valueDecimal:'100',revision:1,observedAtMs:1000,maxAgeMs:10000};
const args={requestedLabelId:'label_0001',baselineDecimal:'100',nowMs:2000};
test('two exact declines trigger alert and two recoveries clear it',()=>{
 const evaluator=createAlertEvaluator({dropBasisPoints:2000});
 assert.equal(evaluator.evaluate({...base,valueDecimal:'79'},args).alert,false);
 assert.equal(evaluator.evaluate({...base,revision:2,valueDecimal:'79'},args).alert,true);
 assert.equal(evaluator.evaluate({...base,revision:3,valueDecimal:'100'},args).alert,true);
 assert.equal(evaluator.evaluate({...base,revision:4,valueDecimal:'100'},args).alert,false);
});
test('old revisions, stale data and synthetic observations do not appear healthy',()=>{
 const evaluator=createAlertEvaluator();
 assert.equal(evaluator.evaluate(base,args).status,'current');
 assert.equal(evaluator.evaluate(base,args).status,'ignored');
 assert.equal(evaluator.evaluate({...base,revision:2,kind:'synthetic'},args).status,'synthetic');
 assert.equal(evaluator.evaluate({...base,revision:3}, {...args,nowMs:20000}).status,'stale');
});
test('wrong label and unverified source fail closed',()=>{
 assert.throws(()=>projectSourceObservation({...base,labelId:'label_0002'},args));
 assert.throws(()=>projectSourceObservation({...base,accessVerified:false},args));
});
test('legacy health and exact goals remain compatible',()=>{
 assert.equal(assessSourceHealth({sourceId:'service',accessVerified:true,lastVerifiedAtMs:1,maxAgeMs:100},200).status,'stale');
 assert.equal(evaluateGoal('9007199254740993','9007199254740992').reached,true);
});
