const ID = /^[A-Za-z0-9_-]{1,128}$/;
function id(value) { if (typeof value !== 'string' || !ID.test(value)) throw new Error('Invalid identifier'); return value; }
function scope(identity,labelId) { id(labelId); if (!identity || !Array.isArray(identity.labels) || !identity.labels.includes(labelId) || !Array.isArray(identity.roles) || !identity.roles.some(role => role === 'view' || role === 'export')) throw new Error('Forbidden'); }
/** Shape a server-scoped event page for a single resource. Events must already come from a tenant-filtered repository query. */
export function projectDrilldown({identity,labelId,resourceId,sourceStatus,events,limit=100}) {
  scope(identity,labelId); id(resourceId);
  if (!['live','cached','awaiting','synthetic'].includes(sourceStatus)) throw new Error('Invalid source status');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !Array.isArray(events) || events.length > limit) throw new Error('Invalid page');
  const seen=new Set();
  const items=events.map(event=>{
    if (!event || event.labelId !== labelId || event.resourceId !== resourceId) throw new Error('Scope mismatch');
    const eventId=id(event.eventId), sourceId=id(event.sourceId), sourceRevision=id(event.sourceRevision);
    if (seen.has(eventId)) throw new Error('Duplicate event'); seen.add(eventId);
    const observedAt=Date.parse(event.observedAt);
    if (!Number.isFinite(observedAt) || new Date(observedAt).toISOString() !== event.observedAt) throw new Error('Invalid provenance time');
    if (typeof event.kind !== 'string' || !['stream','sale','refund','license','points','attendance','royalty','status'].includes(event.kind)) throw new Error('Invalid event kind');
    return Object.freeze({eventId,kind:event.kind,sourceId,sourceRevision,observedAt:event.observedAt,summary:String(event.summary ?? '').slice(0,500)});
  });
  return Object.freeze({labelId,resourceId,sourceStatus,events:items});
}
