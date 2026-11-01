import {projectLabelCatalog} from './catalog-identity.mjs';
import {createCatalogClient} from './catalog-client.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sourceLabels={live:'Live source',cached:'Cached observation',synthetic:'Synthetic demo'};
export function renderCatalog(payload,options){
 const record=projectLabelCatalog(payload,options),titleId='catalog-'+record.labelId+'-'+record.releaseId;
 const works=new Map(record.works.map(work=>[work.workId,work.title]));
 const rows=record.tracks.map(track=>`<tr><th scope="row">${escape(track.title)}</th><td><code>${escape(track.isrc)}</code></td><td>${track.workIds.map(id=>escape(works.get(id))).join(', ')}</td></tr>`).join('');
 const artwork=record.artworkUrl?`<img src="${escape(record.artworkUrl)}" alt="Cover artwork for ${escape(record.title)}" loading="lazy" referrerpolicy="no-referrer">`:'';
 return `<section aria-labelledby="${titleId}"><h2 id="${titleId}">${escape(record.title)}</h2><p>${escape(sourceLabels[record.source.status])} · ${escape(record.source.system)} · revision ${record.source.revision}</p><p>Observed <time datetime="${new Date(record.source.observedAtMs).toISOString()}">${new Date(record.source.observedAtMs).toISOString()}</time></p><p>Release date <time datetime="${record.releaseDate}">${record.releaseDate}</time></p>${artwork}<table><caption>Tracks for ${escape(record.title)}</caption><thead><tr><th scope="col">Track</th><th scope="col">ISRC</th><th scope="col">Composition</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

/** Clear prior label data synchronously, and publish only the latest selection. */
export function createCatalogPresenter({client,onState}){
 if(typeof client?.load!=='function'||typeof client.cancel!=='function'||typeof onState!=='function')
  throw new Error('Invalid catalog presenter');
 let generation=0,disposed=false;
 return Object.freeze({
  async select(labelId){
   if(disposed) return;
   const selected=++generation;
   onState(Object.freeze({status:'loading',labelId,record:null}));
   try{
    const record=await client.load(labelId);
    if(!disposed&&selected===generation){
     if(record.labelId!==labelId) throw new Error('Catalog unavailable');
     onState(Object.freeze({status:'ready',labelId,record}));
    }
   }catch{
    if(!disposed&&selected===generation) onState(Object.freeze({status:'unavailable',labelId,record:null}));
   }
  },
  dispose(){disposed=true;generation++;client.cancel();onState(Object.freeze({status:'cleared',record:null}));}
 });
}

export function mountCatalog(root,options){
 if(!root||typeof root.setAttribute!=='function'||typeof root.replaceChildren!=='function') throw new Error('Invalid catalog mount');
 const {expectedSource,artworkHosts=[],now=()=>Date.now()}=options;
 const client=createCatalogClient(options);
 const presenter=createCatalogPresenter({client,onState(state){
  root.setAttribute('aria-busy',state.status==='loading'?'true':'false');
  root.replaceChildren();
  if(state.status==='ready'){
   root.innerHTML=renderCatalog(state.record,{requestedLabelId:state.labelId,expectedSource,artworkHosts,nowMs:now()});
  }else if(state.status!=='cleared'){
   const message=root.ownerDocument.createElement('p');message.setAttribute('role','status');
   message.textContent=state.status==='loading'?'Loading catalog…':'Catalog is unavailable. Try again.';
   root.append(message);
  }
 }});
 return presenter;
}
