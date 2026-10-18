import {summarizeArtistPortfolio} from './artist-royalties.mjs';

const id=/^[A-Za-z0-9_-]{8,128}$/;
/** Reads only a server-projected artist view; raw cross-artist allocations are forbidden. */
export function createArtistClient({artistId,authorizedLabelIds,fetchImpl=fetch}){
 if(typeof artistId!=='string'||!id.test(artistId)||!Array.isArray(authorizedLabelIds)) throw new Error('Invalid artist');
 const allowed=new Set(authorizedLabelIds);
 let generation=0,controller=null;const revisions=new Map();
 return Object.freeze({
  async load(labelId){
   if(typeof labelId!=='string'||!allowed.has(labelId)) throw new Error('Invalid label');
   generation++;const current=generation;controller?.abort();controller=new AbortController();
   try{
    const response=await fetchImpl('/api/labels/'+encodeURIComponent(labelId)+'/reports/artist',
      {method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('Portfolio unavailable');
    const value=await response.json();
    if(!value||value.artistId!==artistId||!Array.isArray(value.statements)||value.statements.length>10000||
      value.statements.some(item=>item.labelId!==labelId||item.allocations!==undefined||
        item.artistId!==undefined||!id.test(item.statementId||'')||!id.test(item.releaseId||'')||
        !/^[A-Z]{3}$/.test(item.currency||'')||typeof item.amountMinor!=='string'||
        !/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(item.amountMinor)||
        !Number.isSafeInteger(item.source?.revision))) throw new Error('Portfolio unavailable');
    if(current!==generation) throw new Error('Portfolio request superseded');
    for(const item of value.statements){const key=JSON.stringify([labelId,item.statementId]);if(revisions.has(key)&&item.source.revision<revisions.get(key)) throw new Error('Stale portfolio statement');}
    for(const item of value.statements) revisions.set(JSON.stringify([labelId,item.statementId]),item.source.revision);
    return Object.freeze({artistId,statements:Object.freeze(value.statements),totals:summarizeArtistPortfolio(value)});
   }catch(error){if(current!==generation) throw new Error('Portfolio request superseded');throw error;}
  },
  cancel(){generation++;controller?.abort();controller=null;}
 });
}
