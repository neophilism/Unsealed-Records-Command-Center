const ID=/^[A-Za-z0-9_-]{1,128}$/;
function validId(x) { return typeof x==='string' && ID.test(x); }
function validGrant(g,now) { return g?.active===true && ['viewer','operator','owner'].includes(g.role) && Number.isSafeInteger(g.expiresAtMs) && now<g.expiresAtMs && (!g.revokedAtMs || now<g.revokedAtMs); }
/** registry is an authoritative server-side snapshot, loaded for each request. */
export function resolveLabelScope(subject,request,registry,nowMs=Date.now()) {
  if (!subject || subject.serverVerified!==true || !validId(subject.subjectId) || !Array.isArray(subject.grants) || !request || !['label','family','all'].includes(request.kind) || !registry || !Array.isArray(registry.labels) || !Array.isArray(registry.families) || !validId(registry.revision) || !Number.isSafeInteger(nowMs)) throw new Error('Unverified scope');
  const labels=registry.labels.filter(x=>validId(x.id) && x.active===true).map(x=>x.id);
  if (new Set(labels).size!==labels.length || labels.length>1000) throw new Error('Invalid label registry');
  const labelSet=new Set(labels);
  const grants=new Set(subject.grants.filter(g=>validGrant(g,nowMs) && g.registryRevision===registry.revision && labelSet.has(g.labelId)).map(g=>g.labelId));
  if(request.kind==='label') {
    if (!labelSet.has(request.labelId) || !grants.has(request.labelId)) throw new Error('No label permission');
    return Object.freeze([request.labelId]);
  }
  if(request.kind==='family') {
    const family=registry.families.find(f=>f.id===request.familyId && f.active===true);
    const familyGrant=subject.familyGrants?.find(g=>g.familyId===request.familyId && g.registryRevision===registry.revision && validGrant(g,nowMs));
    if(!family || !familyGrant || !Array.isArray(family.labelIds) || !family.labelIds.length || new Set(family.labelIds).size!==family.labelIds.length || !family.labelIds.every(id=>labelSet.has(id)&&grants.has(id))) throw new Error('Incomplete family grant');
    return Object.freeze([...family.labelIds]);
  }
  const allGrant=subject.allLabelsGrant;
  if(!validGrant(allGrant,nowMs) || allGrant.role!=='owner' || allGrant.registryRevision!==registry.revision || !labels.length || !labels.every(id=>grants.has(id))) throw new Error('No all-label grant');
  return Object.freeze(labels);
}
/** A query result must be checked again because upstream joins may leak other labels. */
export function verifyScopeRows(rows,labelIds) {
  if (!Array.isArray(rows) || !Array.isArray(labelIds) || !rows.every(row=>row && labelIds.includes(row.labelId))) throw new Error('Cross-label result');
  return rows;
}
