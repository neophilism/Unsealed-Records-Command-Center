const id=/^[A-Za-z0-9_-]{8,128}$/;
const integer=/^-?(0|[1-9][0-9]*)$/;
const unsigned=/^(0|[1-9][0-9]*)$/;
const fail=()=>{throw new Error('Invalid TooLost statement');};
const lineKinds=new Set(['royalty','reversal','adjustment']);
/** Statement detail projection; source authentication is a server responsibility. */
export function projectTooLostDetail(row,{requestedLabelId,nowMs=Date.now()}={}){
 if(typeof requestedLabelId!=='string'||!id.test(requestedLabelId)||!row||typeof row!=='object'||Array.isArray(row)||
  row.provider!=='TooLost'||row.labelId!==requestedLabelId||!id.test(row.statementId||'')||
  !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period||'')||!/^[A-Z]{3}$/.test(row.currency||'')||
  typeof row.royaltiesMinor!=='string'||!integer.test(row.royaltiesMinor)||row.royaltiesMinor.length>100||
  !Array.isArray(row.lines)||row.lines.length<1||row.lines.length>10000||
  !row.source||row.source.system!=='TooLost'||!['live','synthetic'].includes(row.source.kind)||
  !Number.isSafeInteger(row.source.revision)||row.source.revision<0||
  !Number.isSafeInteger(row.source.observedAtMs)||row.source.observedAtMs<0||
  !Number.isSafeInteger(nowMs)||row.source.observedAtMs>nowMs+30000||
  typeof row.source.documentSha256!=='string'||!/^[a-f0-9]{64}$/.test(row.source.documentSha256)) return fail();
 const seen=new Set();
 const lines=row.lines.map(line=>{
  if(!line||!id.test(line.lineId||'')||seen.has(line.lineId)||!id.test(line.releaseId||'')||
    !id.test(line.trackId||'')||!lineKinds.has(line.kind)||
    typeof line.royaltyMinor!=='string'||!integer.test(line.royaltyMinor)||line.royaltyMinor.length>100||
    (line.kind==='royalty'&&BigInt(line.royaltyMinor)<0n)||
    (line.kind==='reversal'&&BigInt(line.royaltyMinor)>0n)||
    typeof line.units!=='string'||!unsigned.test(line.units)||line.units.length>100) return fail();
  seen.add(line.lineId);
  return Object.freeze({lineId:line.lineId,releaseId:line.releaseId,trackId:line.trackId,
    kind:line.kind,units:line.units,royaltyMinor:line.royaltyMinor});
 });
 const actual=lines.reduce((sum,line)=>sum+BigInt(line.royaltyMinor),0n).toString();
 if(actual!==BigInt(row.royaltiesMinor).toString()) return fail();
 return Object.freeze({statementId:row.statementId,labelId:row.labelId,period:row.period,currency:row.currency,
  royaltiesMinor:actual,lines:Object.freeze(lines),source:Object.freeze({...row.source})});
}

export function selectTooLostLine(statement,lineId){
 if(!statement||!id.test(lineId||'')) return fail();
 const line=statement.lines?.find(item=>item.lineId===lineId);
 if(!line) return fail();
 return line;
}

/** Legacy narrow projection for draft consumers. */
export function projectTooLostStatement(row){
 if(!row||row.provider!=='TooLost'||row.labelAuthorized!==true||row.sourceVerified!==true||
  !id.test(row.statementId||'')||typeof row.labelId!=='string'||row.labelId.length<8||
  !/^[A-Z]{3}$/.test(row.currency||'')||typeof row.royaltiesMinor!=='string'||
  !unsigned.test(row.royaltiesMinor)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period||'')) return fail();
 return Object.freeze({statementId:row.statementId,labelId:row.labelId,period:row.period,currency:row.currency,
  royaltiesMinor:row.royaltiesMinor,source:'TooLost'});
}
