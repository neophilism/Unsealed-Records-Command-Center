/** Bound DOM work while keeping reconciliation against the entire statement. */
export function selectTooLostLines(statement,{query='',kind='all',page=0,pageSize=50}={}){
 if(!statement||!Array.isArray(statement.lines)||statement.lines.length>10000||typeof query!=='string'||query.length>128||
  /[\u0000-\u001f]/.test(query)||!['all','royalty','reversal','adjustment'].includes(kind)||
  !Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)
  throw new Error('Invalid statement line selection');
 const search=query.trim().toLowerCase();
 const matches=statement.lines.filter(line=>(kind==='all'||line.kind===kind)&&
  (!search||[line.lineId,line.releaseId,line.trackId].some(id=>id.toLowerCase().includes(search))));
 const pageCount=Math.max(1,Math.ceil(matches.length/pageSize)),selectedPage=Math.min(page,pageCount-1);
 return Object.freeze({query,kind,page:selectedPage,pageSize,pageCount,totalMatches:matches.length,
  lines:Object.freeze(matches.slice(selectedPage*pageSize,(selectedPage+1)*pageSize))});
}
