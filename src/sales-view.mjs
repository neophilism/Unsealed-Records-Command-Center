import {createSalesClient} from './sales-client.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formatMinorAmount(amount,digits){
 if(typeof amount!=='string'||!/^\-?(0|[1-9][0-9]*)$/.test(amount)||!Number.isSafeInteger(digits)||digits<0||digits>8)
  throw new Error('Amount format unavailable');
 const number=BigInt(amount),negative=number<0n,absolute=negative?-number:number,scale=10n**BigInt(digits);
 const whole=new Intl.NumberFormat('en-US').format(absolute/scale);
 return (negative?'-':'')+whole+(digits?'.'+(absolute%scale).toString().padStart(digits,'0'):'');
}
function rows(currencies,currencyDigits){
 return currencies.map(c=>{
  if(!/^[A-Z]{3}$/.test(c.currency)) throw new Error('Sales data unavailable');
  const amount=name=>Object.hasOwn(currencyDigits,c.currency)?escape(formatMinorAmount(c[name],currencyDigits[c.currency])):'Unavailable';
  return `<tr><th scope="row">${escape(c.currency)}</th><td>${escape(c.orderCount)}</td><td>${amount('grossMinor')}</td><td>${amount('discountMinor')}</td><td>${amount('refundMinor')}</td><td>${amount('feeMinor')}</td><td>${amount('settledNetMinor')}</td><td>${amount('pendingNetMinor')}</td></tr>`;
 }).join('');
}
export function renderSales(summary,{requestedLabelId,currencyDigits={}}){
 if(!summary||summary.labelId!==requestedLabelId||!['awaiting','observed','synthetic','mixed'].includes(summary.availability)||!Array.isArray(summary.currencies)) throw new Error('Sales data unavailable');
 const groups=summary.sourceSummaries;
 if(!Array.isArray(groups)) throw new Error('Sales data unavailable');
 const tables=groups.filter(g=>g.currencies.length).map(group=>{
  const provenance=group.source?`<p>Source: ${escape(group.source.system)}. ${escape(group.source.eventCount)} events observed between <time>${new Date(group.source.observedFromMs).toISOString()}</time> and <time>${new Date(group.source.observedToMs).toISOString()}</time>.</p>`:'';
  return `<section aria-label="${group.kind==='synthetic'?'Synthetic demo':'Observed transactions'}"><h3>${group.kind==='synthetic'?'Synthetic demo':'Observed transactions'}</h3>${provenance}<table><caption>Sales by currency; settled and pending transaction net</caption><thead><tr><th scope="col">Currency</th><th scope="col">Orders</th><th scope="col">Gross</th><th scope="col">Discounts</th><th scope="col">Refunds</th><th scope="col">Fees</th><th scope="col">Settled net</th><th scope="col">Pending net</th></tr></thead><tbody>${rows(group.currencies,currencyDigits)}</tbody></table></section>`;
 }).join('');
 const status=summary.availability==='awaiting'?'Awaiting sales data':summary.availability==='mixed'?'Observed and demo data are shown separately; no combined total.':summary.availability==='synthetic'?'Synthetic demo':'Observed transactions';
 return `<section aria-label="Storefront sales"><h2>Storefront sales</h2><p role="status">${status}</p>${tables}</section>`;
}
export function mountSales(root,options){
 if(!root||typeof root.replaceChildren!=='function') throw new Error('Invalid sales mount');
 const client=createSalesClient(options);let generation=0,disposed=false,currentLabel,selection={};
 const form=()=>{
  const value=name=>escape(typeof selection[name]==='string'?selection[name]:'');
  return `<form data-sales-filters><fieldset><legend>Filter storefront sales</legend><label>Month <input type="month" name="period" value="${value('period')}"></label><label>Country <input name="country" maxlength="2" pattern="[A-Za-z]{2}" value="${value('country')}"></label><label>Storefront <input name="storefront" maxlength="64" pattern="[a-z0-9_-]{2,64}" value="${value('storefront')}"></label><button type="submit">Apply filters</button></fieldset></form>`;
 };
 const load=async(labelId,filters={})=>{
   if(disposed) return;const current=++generation;root.replaceChildren();root.setAttribute('aria-busy','true');
   currentLabel=labelId;selection={...filters};root.innerHTML=form();
   const notice=root.ownerDocument.createElement('p');notice.setAttribute('role','status');notice.textContent='Loading sales…';root.append(notice);
   try{const summary=await client.load(labelId,filters);
    if(!disposed&&current===generation){root.innerHTML=form()+renderSales(summary,{requestedLabelId:labelId,currencyDigits:options.currencyDigits});root.setAttribute('aria-busy','false');}
   }catch{if(!disposed&&current===generation){root.replaceChildren();root.innerHTML=form();notice.textContent='Sales data is unavailable. Try again.';root.append(notice);root.setAttribute('aria-busy','false');}}
 };
 const submit=event=>{
  if(!event.target.matches('form[data-sales-filters]')) return;event.preventDefault();
  const data=new FormData(event.target),next={};for(const name of ['period','country','storefront']){
   let value=String(data.get(name)||'').trim();if(name==='country') value=value.toUpperCase();if(value) next[name]=value;}
  void load(currentLabel,next);
 };
 root.addEventListener('submit',submit);
 return Object.freeze({load,
  dispose(){disposed=true;generation++;client.cancel();root.removeEventListener('submit',submit);root.replaceChildren();root.setAttribute('aria-busy','false');}
 });
}
