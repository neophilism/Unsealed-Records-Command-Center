# URC-04 catalog identity boundary

The catalog projection validates the requested owning label, release ID/date/title, work and track relationships, track-level ISRCs, an HTTPS artwork host allowlist, and source system/revision/time. Its revision guard rejects late or duplicate snapshots per label/release/source. Authorized grouping rejects any release outside the supplied label scope. The same-origin catalog client requests only `/api/labels/{labelId}/reports/catalog`, carries no provider key, and discards an older in-flight response after a label switch.

Run `node --test tests/catalog-*.test.mjs`. The tests cover a valid release, wrong labels, malformed identifiers and ISRC, duplicate or dangling work relations, unsafe artwork, future provenance, late revisions, scope switching, and missing reports.

This projection does not authenticate the upstream source or the user. The production BFF must verify both before returning a catalog response. The Music Operations Engine catalog contract and live provider data have not been verified; do not label this draft as live integration. ISRC syntax is not rights or ownership proof. The legacy `projectLabelRelease` helper remains for compatibility with earlier draft consumers and should be removed when all callers migrate.
