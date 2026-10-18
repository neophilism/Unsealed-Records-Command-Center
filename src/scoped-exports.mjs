import {createHmac, createHash, timingSafeEqual} from 'node:crypto';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
function requireId(value, name) { if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new TypeError(`Invalid ${name}`); return value; }
function validateIdentity(identity, labelId, role) {
  if (!identity || !requireId(identity.subjectId, 'subject') || !Array.isArray(identity.labels) || !identity.labels.includes(labelId) || !Array.isArray(identity.roles) || !identity.roles.includes(role)) throw new Error('Forbidden');
}
function csvCell(value) {
  const raw = value == null ? '' : String(value);
  if (raw.length > 32768) throw new Error('Cell exceeds limit');
  const escaped = /^[\s\u0000-\u001f]*[=+@-]/u.test(raw) ? `'${raw}` : raw;
  return `"${escaped.replaceAll('"', '""')}"`;
}
export function makeCsv(columns, records, maxRows = 10000) {
  if (!Array.isArray(columns) || !columns.length || columns.length > 64 || !columns.every(c => typeof c === 'string' && SAFE_ID.test(c))) throw new Error('Invalid columns');
  if (!Array.isArray(records) || records.length > maxRows) throw new Error('Export exceeds row limit');
  return '\ufeff' + [columns.map(csvCell).join(','), ...records.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n') + '\r\n';
}
function payloadSignature(payload, key) { return createHmac('sha256', key).update(payload).digest('base64url'); }
export function signExportTicket({subjectId, labelId, exportId, expiresAtMs}, key) {
  if (!Buffer.isBuffer(key) || key.length < 32) throw new Error('Invalid signing key');
  for (const [name, value] of Object.entries({subjectId,labelId,exportId})) requireId(value,name);
  if (!Number.isSafeInteger(expiresAtMs)) throw new Error('Invalid expiry');
  const payload = Buffer.from(JSON.stringify({subjectId,labelId,exportId,expiresAtMs})).toString('base64url');
  return `${payload}.${payloadSignature(payload,key)}`;
}
export function verifyExportTicket(ticket, key, nowMs) {
  if (typeof ticket !== 'string' || ticket.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket) || !Buffer.isBuffer(key) || key.length < 32) throw new Error('Invalid ticket');
  const [payload,mac] = ticket.split('.');
  const expected = payloadSignature(payload,key);
  const a = Buffer.from(mac); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a,b)) throw new Error('Invalid ticket');
  const claims = JSON.parse(Buffer.from(payload,'base64url').toString());
  for (const [name,value] of Object.entries({subjectId:claims.subjectId,labelId:claims.labelId,exportId:claims.exportId})) requireId(value,name);
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(claims.expiresAtMs) || nowMs >= claims.expiresAtMs) throw new Error('Expired ticket');
  return claims;
}
/** Dependencies are server-owned; the caller must supply a durable audit repository. */
export function createExportService({loadRows, persistExport, appendAudit, loadExport, isRevoked, key, now = Date.now}) {
  for (const fn of [loadRows,persistExport,appendAudit,loadExport,isRevoked,now]) if (typeof fn !== 'function') throw new TypeError('Missing server dependency');
  if (!Buffer.isBuffer(key) || key.length < 32) throw new TypeError('Invalid signing key');
  return {
    async request({identity,labelId,resourceId,columns,exportId,purpose}) {
      requireId(labelId,'label'); requireId(resourceId,'resource'); requireId(exportId,'export');
      validateIdentity(identity,labelId,'export');
      if (!['accounting','analytics','compliance'].includes(purpose)) throw new Error('Invalid purpose');
      const result = await loadRows({labelId,resourceId,subjectId:identity.subjectId});
      if (!result || !Array.isArray(result.rows) || !result.rows.every(row => row.labelId === labelId && row.resourceId === resourceId) || !requireId(result.sourceEventId,'source event') || !requireId(result.sourceRevision,'source revision')) throw new Error('Source scope mismatch');
      const csv = makeCsv(columns,result.rows);
      const digest = createHash('sha256').update(csv).digest('hex');
      const expiresAtMs = now() + 5 * 60_000;
      const persisted = await persistExport({exportId,labelId,resourceId,subjectId:identity.subjectId,csv,digest,expiresAtMs,sourceEventId:result.sourceEventId,sourceRevision:result.sourceRevision});
      if (!persisted || persisted.durable !== true) throw new Error('Export persistence unavailable');
      const audit = await appendAudit({kind:'EXPORT_CREATED',exportId,labelId,resourceId,subjectId:identity.subjectId,purpose,sourceEventId:result.sourceEventId,sourceRevision:result.sourceRevision,digest,expiresAtMs});
      if (!audit || !requireId(audit.eventId,'audit event') || audit.durable !== true) throw new Error('Durable audit unavailable');
      // Do not release a ticket until both persistence and the audit sink confirm durability.
      return {ticket:signExportTicket({subjectId:identity.subjectId,labelId,exportId,expiresAtMs},key),exportId,expiresAtMs,auditEventId:audit.eventId,digest,sourceEventId:result.sourceEventId,sourceRevision:result.sourceRevision,csv};
    },
    async download({identity,labelId,ticket}) {
      requireId(labelId,'label'); validateIdentity(identity,labelId,'export');
      const claims = verifyExportTicket(ticket,key,now());
      if (claims.subjectId !== identity.subjectId || claims.labelId !== labelId) throw new Error('Forbidden');
      if (await isRevoked({exportId:claims.exportId,labelId,subjectId:identity.subjectId})) throw new Error('Revoked');
      const stored = await loadExport({exportId:claims.exportId,labelId,subjectId:identity.subjectId});
      if (!stored || stored.labelId !== labelId || stored.subjectId !== identity.subjectId || stored.expiresAtMs !== claims.expiresAtMs || typeof stored.csv !== 'string' || createHash('sha256').update(stored.csv).digest('hex') !== stored.digest) throw new Error('Export unavailable');
      const audit = await appendAudit({kind:'EXPORT_DOWNLOADED',exportId:claims.exportId,labelId,subjectId:identity.subjectId,digest:stored.digest});
      if (!audit || audit.durable !== true || !requireId(audit.eventId,'audit event')) throw new Error('Durable audit unavailable');
      return {contentType:'text/csv; charset=utf-8',cacheControl:'no-store',body:stored.csv,auditEventId:audit.eventId};
    }
  };
}
