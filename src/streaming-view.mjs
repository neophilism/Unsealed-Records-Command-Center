import {selectStreamingRecords} from './streaming-insights.mjs';
import {createStreamingClient} from './streaming-client.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const exact=value=>new Intl.NumberFormat('en-US').format(BigInt(value));
const states={live:'Live source',cached:'Cached observations',synthetic:'Synthetic demo',mixed:'Mixed observed and synthetic data; total withheld',awaiting:'Awaiting source data'};
export function renderStreaming(result,options){
 if(!result||result.labelId!==options.requestedLabelId) throw new Error('Streaming data unavailable');
 const current=selectStreamingRecords(result.records,options);
 const total=current.totalStreams===null?'Unavailable':exact(current.totalStreams);
 const rows=current.records.map(r=>`<tr><th scope="row">${escape(r.period)}</th><td>${escape(r.country)}</td><td>${escape(r.platform)}</td><td>${exact(r.streams)}</td><td>${escape(states[r.state])}</td><td>${escape(r.source.system)} · <time datetime="${new Date(r.source.observedAtMs).toISOString()}">${new Date(r.source.observedAtMs).toISOString()}</time> · revision ${r.source.revision}</td></tr>`).join('');
 return `<section aria-label="Streaming insights"><h2>Streaming insights</h2><p role="status">${escape(states[current.availability])}</p><p>Total streams: <strong>${total}</strong></p><table><caption>Streams by month, country and platform</caption><thead><tr><th scope="col">Month</th><th scope="col">Country</th><th scope="col">Platform</th><th scope="col">Streams</th><th scope="col">Source state</th><th scope="col">Observed</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
function filterForm(filters){
 const value=name=>escape(typeof filters[name]==='string'?filters[name]:'');
 return `<form data-streaming-filters><fieldset><legend>Filter streaming insights</legend><label>Month <input type="month" name="period" value="${value('period')}"></label><label>Country (two-letter code or ALL) <input name="country" maxlength="3" pattern="[A-Za-z]{2}|ALL" value="${value('country')}"></label><label>Platform <input name="platform" maxlength="64" pattern="[a-z0-9_-]{2,64}" value="${value('platform')}"></label><button type="submit">Apply filters</button></fieldset></form>`;
}
export function mountStreaming(root,options){
 if(!root||typeof root.replaceChildren!=='function'||typeof root.addEventListener!=='function') throw new Error('Invalid streaming mount');
 const client=createStreamingClient(options);let generation=0,disposed=false,labelId,filters={};
 const show=(state,result)=>{
  root.setAttribute('aria-busy',state==='loading'?'true':'false');
  root.replaceChildren();if(state==='cleared') return;
  const content=state==='ready'?renderStreaming(result,{requestedLabelId:labelId,expectedSource:options.expectedSource,
   nowMs:(options.now||Date.now)(),freshnessMs:options.freshnessMs??86400000}):
   `<p role="status">${state==='loading'?'Loading streaming insights…':'Streaming data is unavailable. Try again.'}</p>`;
  root.innerHTML=filterForm(filters)+content;
 };
 const load=async(selectedLabel,selection={})=>{
  if(disposed) return;const selected=++generation;labelId=selectedLabel;filters={...selection};show('loading');
  try{const result=await client.load(selectedLabel,selection);if(!disposed&&selected===generation) show('ready',result);}
  catch{if(!disposed&&selected===generation) show('unavailable');}
 };
 const submit=event=>{
  if(!event.target.matches('form[data-streaming-filters]')) return;event.preventDefault();
  const data=new FormData(event.target),next={};
  for(const name of ['period','country','platform']){let value=String(data.get(name)||'').trim();
   if(name==='country') value=value.toUpperCase();if(value) next[name]=value;}
  void load(labelId,next);
 };
 root.addEventListener('submit',submit);
 return Object.freeze({load,dispose(){disposed=true;generation++;client.cancel();root.removeEventListener('submit',submit);show('cleared');}});
}
