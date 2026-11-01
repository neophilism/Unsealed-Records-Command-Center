import {projectTooLostDetail} from './toolost-statement.mjs';
import {createTooLostClient} from './toolost-client.mjs';
import {createDocumentComparison} from './toolost-comparison.mjs';
import {selectTooLostLines} from './toolost-lines.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function amount(value,digits){
 if(!Number.isSafeInteger(digits)||digits<0||digits>8) return 'Unavailable';
 const n=BigInt(value),a=n<0n?-n:n,scale=10n**BigInt(digits);
 return (n<0n?'-':'')+new Intl.NumberFormat('en-US').format(a/scale)+(digits?'.'+(a%scale).toString().padStart(digits,'0'):'');
}
export function renderTooLost(payload,{requestedLabelId,nowMs=Date.now(),currencyDigits={},selection={}}){
 const statement=projectTooLostDetail(payload,{requestedLabelId,nowMs});
 const digits=Object.hasOwn(currencyDigits,statement.currency)?currencyDigits[statement.currency]:undefined;
 const selected=selectTooLostLines(statement,selection);
 const lines=selected.lines.map(line=>`<tr><th scope="row"><details><summary>${escape(line.lineId)} — ${escape(line.kind)}</summary><dl><dt>Release</dt><dd>${escape(line.releaseId)}</dd><dt>Track</dt><dd>${escape(line.trackId)}</dd></dl></details></th><td>${new Intl.NumberFormat('en-US').format(BigInt(line.units))}</td><td>${amount(line.royaltyMinor,digits)}</td></tr>`).join('');
 const controls=`<form data-toolost-search><label>Find line, release or track <input name="query" maxlength="128" value="${escape(selected.query)}"></label><label>Line type <select name="kind">${['all','royalty','reversal','adjustment'].map(k=>`<option value="${k}"${k===selected.kind?' selected':''}>${k}</option>`).join('')}</select></label><button type="submit">Search lines</button></form><p role="status">${selected.totalMatches} matching lines. Page ${selected.page+1} of ${selected.pageCount}. The statement total covers all lines.</p><button type="button" data-toolost-page="${selected.page-1}"${selected.page===0?' disabled':''}>Previous page</button><button type="button" data-toolost-page="${selected.page+1}"${selected.page+1===selected.pageCount?' disabled':''}>Next page</button>`;
 return `<section aria-label="TooLost statement"><h2>TooLost statement ${escape(statement.statementId)}</h2><p role="status">${statement.source.kind==='synthetic'?'Synthetic demo':'Observed statement'}</p><p>Period: ${statement.period}. Currency: ${statement.currency}. Total royalties: <strong>${amount(statement.royaltiesMinor,digits)}</strong></p><p>Source: TooLost. Revision ${statement.source.revision}. Observed <time>${new Date(statement.source.observedAtMs).toISOString()}</time>.</p>${controls}<table><caption>Royalty, reversal and adjustment lines</caption><thead><tr><th scope="col">Line details</th><th scope="col">Units</th><th scope="col">Royalty amount (${statement.currency})</th></tr></thead><tbody>${lines}</tbody></table><p>Claimed document SHA-256: <code>${statement.source.documentSha256}</code></p><label>Compare a local statement document <input type="file" data-toolost-document></label><p>Comparison runs locally; the document is not uploaded.</p><p role="status" data-toolost-comparison>No document compared.</p></section>`;
}
export function mountTooLost(root,options){
 if(!root||typeof root.replaceChildren!=='function'||typeof root.addEventListener!=='function') throw new Error('Invalid statement mount');
 const client=createTooLostClient(options);let generation=0,disposed=false,statement=null,labelId=null;
 const now=options.now||Date.now;let selection={};
 const render=()=>{comparison.clear();root.innerHTML=renderTooLost(statement,{requestedLabelId:labelId,nowMs:now(),currencyDigits:options.currencyDigits,selection});};
 const showNotice=message=>{root.replaceChildren();const p=root.ownerDocument.createElement('p');p.setAttribute('role','status');p.textContent=message;root.append(p);};
 const comparison=createDocumentComparison({now,onState(state){
  if(disposed||state.status==='cleared') return;
  const status=root.querySelector('[data-toolost-comparison]');if(!status) return;
  const result=state.result;
  status.textContent=state.status==='comparing'?'Comparing document…':state.status==='unavailable'?'Document comparison is unavailable.':
   result.matches?(result.sourceKind==='synthetic'?'Synthetic demo document hash matches.':'Document hash matches; provider authenticity is not established by this comparison.'):'The document does not match this statement.';
 }});
 const compare=event=>{
  if(!event.target.matches('input[data-toolost-document]')||!statement) return;
  void comparison.compare(event.target.files?.[0],statement,{requestedLabelId:labelId});
 };
 const search=event=>{
  if(!event.target.matches('form[data-toolost-search]')||!statement) return;event.preventDefault();
  const data=new FormData(event.target);selection={query:String(data.get('query')||''),kind:String(data.get('kind')||'all'),page:0};render();
 };
 const page=event=>{
  const button=event.target.closest('button[data-toolost-page]');if(!button||button.disabled||!root.contains(button)||!statement) return;
  selection={...selection,page:Number(button.dataset.toolostPage)};render();
 };
 root.addEventListener('change',compare);root.addEventListener('submit',search);root.addEventListener('click',page);
 return Object.freeze({
  async load(selectedLabel,statementId,selection={}){
   if(disposed) return;const current=++generation;comparison.clear();statement=null;labelId=selectedLabel;
   root.setAttribute('aria-busy','true');showNotice('Loading statement…');
   try{const value=await client.load(selectedLabel,statementId,selection);
    if(disposed||current!==generation) return;
    statement=value;selection={};render();
   }catch{if(!disposed&&current===generation) showNotice('Statement is unavailable. Try again.');}
   finally{if(!disposed&&current===generation) root.setAttribute('aria-busy','false');}
  },
  dispose(){disposed=true;generation++;comparison.clear();statement=null;client.cancel();root.removeEventListener('change',compare);root.removeEventListener('submit',search);root.removeEventListener('click',page);root.replaceChildren();root.setAttribute('aria-busy','false');}
 });
}
