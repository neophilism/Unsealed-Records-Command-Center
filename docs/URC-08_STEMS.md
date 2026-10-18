# URC-08 Stems White Label commerce boundary

The read-only receipt projection validates provider, owning label, order, product, license, status, source revision, and exact minor-unit breakdown of gross, tax, fees, refunds and creator income. It rejects conflicting event replays, older order revisions and active entitlements on refunded or synthetic records. The same-origin client reads `/api/labels/{labelId}/reports/stems` through the authenticated BFF without a provider key and discards old in-flight results after a label switch.

Run `node --test tests/stems-commerce.test.mjs tests/stems-client.test.mjs`. These tests exercise amount reconciliation, replay, label isolation, synthetic receipts and scope switching.

This code cannot initiate checkout, authorize payment, grant a download or establish license rights. No Stems account, provider contract, durable transaction ledger, tax calculation, refund processor, or server-side rights verification has been observed. Those dependencies and transaction-specific approvals must be in place before a live purchase flow is enabled. The legacy `projectStemsProduct` offer helper remains for earlier draft consumers; its caller flags are not provider proof.
