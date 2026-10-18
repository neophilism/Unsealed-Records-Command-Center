# URC-14 scoped exports and audit

`src/scoped-exports.mjs` is a server-side export service. The BFF must obtain `identity` from its verified session, use a repository scoped to the authenticated label and resource for `loadRows`, and supply durable `persistExport`, append-only `appendAudit`, `loadExport`, and revocation adapters. The signing key is server-only, randomly generated, and at least 32 bytes. Never pass browser flags as server authorization.

Request flow: verify export role and label membership; verify every selected row's label and resource; cap rows and cell sizes; encode CSV with formula escaping; hash and persist bytes; append an immutable `EXPORT_CREATED` record with source event and revision; then issue a five-minute subject/label/export-bound HMAC ticket. The audit event omits CSV contents. A failed persistence or audit receipt yields no ticket. An orphaned blob after audit failure must be garbage-collected by the storage adapter.

Download flow: recheck current role and label membership, ticket signature and expiry, revocation, stored scope and digest; append a durable `EXPORT_DOWNLOADED` record before returning bytes with `Cache-Control: no-store`. The delivery endpoint must set `Content-Disposition: attachment` and a CSP suitable for CSV. Apply request rate limits and storage quotas at the BFF boundary.

The module intentionally does not claim a live Engine schema, deployed endpoint, database transaction, storage bucket, or upstream label-account access. Wire those dependencies and test the actual adapters before declaring product acceptance. `node --test tests/scoped-exports.test.mjs` exercises scope rejection, role rejection, tampering, expiry, revocation, CSV injection, size cap, integrity, and audit failures.
