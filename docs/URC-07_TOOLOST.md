# URC-07 TooLost statement boundary

The statement projection validates label, statement, period, currency, line IDs, release/track links, signed royalty amounts, source revision and document SHA-256. It reconciles the exact `BigInt` sum of royalty, reversal and adjustment lines to the declared statement total. Synthetic records retain their synthetic marker. Line drill-down cannot select an absent line.

The same-origin client requests `/api/labels/{labelId}/reports/toolost` through the authenticated BFF without a provider key. It rejects wrong-label responses, duplicate statement IDs and older revisions, and discards in-flight results after a scope switch. Run `node --test tests/toolost-statement.test.mjs tests/toolost-client.test.mjs`.

No TooLost provider API, document ingestion, payout reconciliation, or authenticated Music Operations Engine statement contract has been verified. The BFF must enforce user grants and source authentication, and the document hash must be compared to the actual provider artifact before this view is treated as live evidence. The legacy `projectTooLostStatement` remains for earlier draft consumers.
