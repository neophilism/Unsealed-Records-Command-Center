import {projectTooLostDetail} from './toolost-statement.mjs';
import {createTooLostClient} from './toolost-client.mjs';
import {compareTooLostArtifact} from './toolost-artifact.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function amount(value,digits){
 if(!Number.isSafeInteger(digits)||digits<0||digits>8) return 'Unavailable';
 const n=BigInt(value),a=n<0n?-n:n,scale=10n**BigInt(digits);
 return (n<0n?'-':'')+new Intl.NumberFormat('en-US').format(a/scale)+(digits?'.'+(a%scale).toString().padStart(digits,'0'):'');
}
export function renderTooLost(payload,{requestedLabelId,nowMs=Date.now(),currencyDigits={}}){
 const statement=projectTooLostDetail(payload,{requestedLabelId,nowMs});
 const digits=Object.hasOwn(currencyDigits,statement.currency)?currencyDigits[statement.currency]:undefined;
 const lines=statement.lines.map(line=>`<tr><th scope="row"><details><summary>${escape(line.lineId)} — ${escape(line.kind)}</summary><dl><dt>Release</dt><dd>${escape(line.releaseId)}</dd><dt>Track</dt><dd>${escape(line.trackId)}</dd></dl></details></th><td>${new Intl.NumberFormat('en-US').format(BigInt(line.units))}</td><td>${amount(line.royaltyMinor,digits)}</td></tr>`).join('');
 return `<section aria-label="TooLost statement"><h2>TooLost statement ${escape(statement.statementId)}</h2><p role="status">${statement.source.kind==='synthetic'?'Synthetic demo':'Observed statement'}</p><p>Period: ${statement.period}. Currency: ${statement.currency}. Total royalties: <strong>${amount(statement.royaltiesMinor,digits)}</strong></p><p>Source: TooLost. Revision ${statement.source.revision}. Observed <time>${new Date(statement.source.observedAtMs).toISOString()}</time>.</p><table><caption>Royalty, reversal and adjustment lines</caption><thead><tr><th scope="col">Line details</th><th scope="col">Units</th><th scope="col">Royalty amount (${statement.currency})</th></tr></thead><tbody>${lines}</tbody></table><p>Claimed document SHA-256: <code>${statement.source.documentSha256}</code></p><label>Compare a local statement document <input type="file" data-toolost-document></label><p>Comparison runs locally; the document is not uploaded.</p><p role="status" data-toolost-comparison>No document compared.</p></section>`;
}
export function mountTooLost(root,options){
 if(!root||typeof root.replaceChildren!=='function'||typeof root.addEventListener!=='function') throw new Error('Invalid statement mount');
 const client=createTooLostClient(options);let generation=0,disposed=false,statement=null,labelId=null;
 const now=options.now||Date.now;
 const showNotice=message=>{root.replaceChildren();const p=root.ownerDocument.createElement('p');p.setAttribute('role','status');p.textContent=message;root.append(p);};
 const compare=async event=>{
  if(!event.target.matches('input[data-toolost-document]')||!statement) return;
  const file=event.target.files?.[0],current=generation,selected=statement,selectedLabel=labelId;
  const status=root.querySelector('[data-toolost-comparison]');
  if(!file||file.size<1||file.size>16000000){status.textContent='Document comparison is unavailable.';return;}
  status.textContent='Comparing document…';
  try{
   const bytes=new Uint8Array(await file.arrayBuffer());if(disposed||current!==generation) return;
   const result=await compareTooLostArtifact(bytes,selected,{requestedLabelId:selectedLabel,nowMs:now()});
   if(disposed||current!==generation) return;
   status.textContent=result.matches?(result.sourceKind==='synthetic'?'Synthetic demo document hash matches.':'Document hash matches; provider authenticity is not established by this comparison.'):'The document does not match this statement.';
  }catch{if(!disposed&&current===generation) status.textContent='Document comparison is unavailable.';}
 };
 root.addEventListener('change',compare);
 return Object.freeze({
  async load(selectedLabel,statementId,selection={}){
   if(disposed) return;const current=++generation;statement=null;labelId=selectedLabel;
   root.setAttribute('aria-busy','true');showNotice('Loading statement…');
   try{const value=await client.load(selectedLabel,statementId,selection);
    if(disposed||current!==generation) return;
    root.innerHTML=renderTooLost(value,{requestedLabelId:selectedLabel,nowMs:now(),currencyDigits:options.currencyDigits});statement=value;
   }catch{if(!disposed&&current===generation) showNotice('Statement is unavailable. Try again.');}
   finally{if(!disposed&&current===generation) root.setAttribute('aria-busy','false');}
  },
  dispose(){disposed=true;generation++;statement=null;client.cancel();root.removeEventListener('change',compare);root.replaceChildren();root.setAttribute('aria-busy','false');}
 });
}
