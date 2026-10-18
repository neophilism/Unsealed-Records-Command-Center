# URC-13 source health and alert decisions

The source observation projection rejects wrong labels, unverified identities, future timestamps and invalid revisions. The alert evaluator compares exact decimal metrics to an authorized baseline, requires consecutive breaches and recoveries to reduce flapping, and treats stale or synthetic observations explicitly. Replayed and out-of-order source revisions are ignored. The same-origin client rejects an old label scope and sends no provider credential.

Run `node --test tests/source-health.test.mjs tests/health-client.test.mjs`. This code makes read-only dashboard decisions. Alert state is in memory and is not durable or delivered to owners. No live monitoring feed, persisted baseline, notification service, escalation policy or end-to-end provider check has been verified. The production BFF must authenticate source reports and label access; a server worker must persist state and handle delivery before claiming operational alerts.
