const id=/^[A-Za-z0-9_-]{3,128}$/;
const decimal=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid source observation');};
export function projectSourceObservation(x,{requestedLabelId,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||!x||typeof x!=='object'||Array.isArray(x)||
  x.labelId!==requestedLabelId||!id.test(x.sourceId||'')||!id.test(x.metricId||'')||
  x.accessVerified!==true||!['live','synthetic'].includes(x.kind)||
  typeof x.valueDecimal!=='string'||!decimal.test(x.valueDecimal)||x.valueDecimal.length>100||
  !Number.isSafeInteger(x.revision)||x.revision<0||!Number.isSafeInteger(x.observedAtMs)||
  !Number.isSafeInteger(nowMs)||x.observedAtMs>nowMs+30000||
  !Number.isSafeInteger(x.maxAgeMs)||x.maxAgeMs<=0) return fail();
 return Object.freeze({labelId:x.labelId,sourceId:x.sourceId,metricId:x.metricId,
  valueDecimal:x.valueDecimal,revision:x.revision,observedAtMs:x.observedAtMs,
  maxAgeMs:x.maxAgeMs,kind:x.kind});
}

/** Stateful decisions only; alert delivery and persistence are separate services. */
export function createAlertEvaluator({dropBasisPoints=2000,breachesRequired=2,recoveriesRequired=2}={}){
 if(!Number.isSafeInteger(dropBasisPoints)||dropBasisPoints<1||dropBasisPoints>9999||
  !Number.isSafeInteger(breachesRequired)||breachesRequired<1||
  !Number.isSafeInteger(recoveriesRequired)||recoveriesRequired<1) throw new Error('Invalid alert policy');
 const state=new Map();
 return Object.freeze({evaluate(raw,{requestedLabelId,baselineDecimal,nowMs=Date.now()}){
  const obs=projectSourceObservation(raw,{requestedLabelId,nowMs});
  if(typeof baselineDecimal!=='string'||!decimal.test(baselineDecimal)||baselineDecimal==='0') return fail();
  const key=JSON.stringify([obs.labelId,obs.sourceId,obs.metricId]);
  const previous=state.get(key);
  if(previous&&obs.revision<=previous.revision) return Object.freeze({status:'ignored',reason:'old_revision'});
  if(previous&&obs.observedAtMs<previous.observedAtMs) return Object.freeze({status:'ignored',reason:'old_observation'});
  const next=previous?{...previous}:{revision:-1,observedAtMs:-1,breaches:0,recoveries:0,alert:false};
  next.revision=obs.revision;next.observedAtMs=obs.observedAtMs;
  if(obs.kind==='synthetic'){state.set(key,next);return Object.freeze({status:'synthetic',alert:false});}
  if(nowMs-obs.observedAtMs>obs.maxAgeMs){state.set(key,next);return Object.freeze({status:'stale',alert:true,reason:'source_stale'});}
  const value=BigInt(obs.valueDecimal),baseline=BigInt(baselineDecimal);
  const breach=value*10000n<baseline*BigInt(10000-dropBasisPoints);
  if(breach){next.breaches++;next.recoveries=0;if(next.breaches>=breachesRequired) next.alert=true;}
  else{next.recoveries++;next.breaches=0;if(next.recoveries>=recoveriesRequired) next.alert=false;}
  state.set(key,next);
  return Object.freeze({status:next.alert?'alert':'current',alert:next.alert,reason:next.alert?'metric_drop':null});
 }});
}

export function assessSourceHealth(x,nowMs){if(!x||x.accessVerified!==true||typeof x.sourceId!=='string'||x.sourceId.length<3||!Number.isFinite(x.lastVerifiedAtMs)||!Number.isFinite(nowMs)||x.lastVerifiedAtMs>nowMs||!Number.isSafeInteger(x.maxAgeMs)||x.maxAgeMs<=0)return Object.freeze({status:'unknown'});return Object.freeze({status:nowMs-x.lastVerifiedAtMs>x.maxAgeMs?'stale':'current',sourceId:x.sourceId});}
export function evaluateGoal(currentDecimal,targetDecimal){if(typeof currentDecimal!=='string'||typeof targetDecimal!=='string'||!decimal.test(currentDecimal)||!decimal.test(targetDecimal)||targetDecimal==='0')throw new Error('Invalid goal');return Object.freeze({reached:BigInt(currentDecimal)>=BigInt(targetDecimal)});}
