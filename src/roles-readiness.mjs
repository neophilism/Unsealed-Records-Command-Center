const ACTION_ROLES=Object.freeze({view:['viewer','operator','owner'],export:['operator','owner'],operate:['operator','owner'],manage:['owner']});
const LABEL=/^[A-Za-z0-9_-]{8,128}$/;
/** identity and grants must come from a server-verified session, never request body data. */
export function authorizeLabelAction(user,labelId,action,nowMs=Date.now()) {
  if (!user || user.identityVerified !== true || typeof user.subjectId !== 'string' || user.subjectId.length < 8 || !LABEL.test(labelId) || !Object.hasOwn(ACTION_ROLES,action) || !Number.isSafeInteger(nowMs) || !Array.isArray(user.grants)) return false;
  return user.grants.some(grant=> grant?.labelId===labelId && grant.active===true && ACTION_ROLES[action].includes(grant.role) && Number.isSafeInteger(grant.expiresAtMs) && nowMs < grant.expiresAtMs && (!grant.revokedAtMs || nowMs < grant.revokedAtMs));
}
export function canViewLabel(user,labelId,nowMs=Date.now()) { return authorizeLabelAction(user,labelId,'view',nowMs); }
/** Multi-label requests must authorize every member before a query is issued. */
export function authorizeScope(user, labelIds, action, nowMs=Date.now()) {
  if (!Array.isArray(labelIds) || !labelIds.length || labelIds.length > 50 || new Set(labelIds).size !== labelIds.length || !labelIds.every(labelId=>authorizeLabelAction(user,labelId,action,nowMs))) throw new Error('Scope forbidden');
  return Object.freeze([...labelIds]);
}
export function selectAuthorizedRows(rows, labels) {
  if (!Array.isArray(rows) || !Array.isArray(labels)) throw new Error('Invalid data');
  const scope=new Set(labels);
  if (!rows.every(row=>row && scope.has(row.labelId))) throw new Error('Query crossed authorized scope');
  return rows;
}
const REQUIRED=['accessibility','mobile','authorization','sourceIntegration','incidentResponse','backupRestore'];
/** Readiness is a report over independently gathered evidence, never a replacement for live verification. */
export function evaluateProductionReadiness(checks) {
  const missing=REQUIRED.filter(name=>{
    const check=checks?.[name];
    return check?.verified!==true || check?.passed!==true || typeof check.evidenceUrl!=='string' || !/^https:\/\//.test(check.evidenceUrl) || typeof check.observedAt!=='string' || !Number.isFinite(Date.parse(check.observedAt));
  });
  return Object.freeze({ready:missing.length===0,missing});
}
export function acceptProductionReadiness(checks) { return evaluateProductionReadiness(checks).ready; }
