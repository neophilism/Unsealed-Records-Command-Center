export const emptySummary={synthetic:false,loading:true,counts:{sales:0,streams:0,plays:0,attendees:0,events:0},currencies:{},bySource:{},byRelease:{},daily:[]};
export function scopeQuery(value) {
  if(value === 'all') return '';
  const match=/^(label|family):([a-zA-Z0-9][a-zA-Z0-9._:-]{0,127})$/.exec(value);
  if(!match) throw new Error('Invalid label selection');
  return '?'+new URLSearchParams({[match[1]+'Id']:match[2]}).toString();
}
export function scopeOptions(menu) {
  return [{value:'all',name:menu?.all?.name || 'All accessible labels'},
    ...(menu?.families || []).map(f=>({value:'family:'+f.id,name:'Family · '+f.name})),
    ...(menu?.labels || []).map(l=>({value:'label:'+l.id,name:l.name}))];
}
export function matchesScope(selection,summary) {
  if(!summary?.counts || typeof summary.counts !== 'object') return false;
  if(selection === 'all') return true;
  const [kind,...parts]=selection.split(':');const id=parts.join(':');
  if(kind === 'family') return summary.scope?.familyId === id;
  return summary.scope?.labelIds?.length === 1 && summary.scope.labelIds[0] === id;
}
export function rankReleases(byRelease={}) {
  return Object.entries(byRelease).sort((a,b)=>{
    const left=BigInt(a[1].streams || 0),right=BigInt(b[1].streams || 0);
    return left < right ? 1 : left > right ? -1 : a[0].localeCompare(b[0]);
  });
}
export function formatInteger(value) { return new Intl.NumberFormat('en-US').format(BigInt(value || 0)); }
export function formatPoints(microunits) {
  const units=BigInt(microunits || 0),whole=units/1000000n;
  const fraction=(units%1000000n).toString().padStart(6,'0').replace(/0+$/,'');
  return formatInteger(whole)+(fraction ? '.'+fraction : '');
}
