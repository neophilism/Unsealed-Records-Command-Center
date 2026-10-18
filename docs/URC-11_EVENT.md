# URC-11 event calendar and QR boundary

The public event projection validates owning label, publication flags, schedule, cancellation status, source revision and an HTTPS destination on an explicit host allowlist. It excludes attendee identities and private venue details. The same-origin client rejects wrong-label and older results after scope changes.

The server-side QR issuer creates HMAC-SHA-256 signed links scoped to one label, event and campaign, with a maximum 24-hour lifetime. Tokens contain no attendee identity or location. A QR verifier checks signature and expiry; a live scanner must also recheck current event publication/cancellation and campaign status before redirecting to the approved public URL. These public links do not grant access or count attendance by themselves.

Run `node --test tests/event-calendar.test.mjs tests/event-client.test.mjs`. No actual calendar source, QR scan endpoint, consent-based attribution, or production signing-key store is connected. The BFF must authenticate label publication and keep the signing key server-side. The legacy `projectPublicEvent` remains for earlier draft consumers.
