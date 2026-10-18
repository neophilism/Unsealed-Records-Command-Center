# URC-05 streaming insights boundary

The projection validates label, month, country, platform, exact decimal stream count, source system, revision and observation time. It selects the newest revision for each period/country/platform tuple and sums counts with `BigInt`, returning a decimal string. A missing selection returns `availability: "awaiting"` and `totalStreams: null`; it does not imply zero streams. Source state distinguishes live, cached and explicitly synthetic data. Mixed synthetic and observed records are marked mixed.

The same-origin client reads `/api/labels/{labelId}/reports/streams` through the authenticated BFF with no provider key. It rejects wrong-label responses and older revisions across requests, and cancels or discards old in-flight results after scope changes. Filters are applied to the authenticated response. Run `node --test tests/streaming-*.test.mjs` for exact counts, filters, provenance, ordering, missing data and scope-switch tests.

No Music Operations Engine streaming contract or provider feed has been verified in this repository. The current code does not prove live analytics, source freshness, tenant authorization or production accessibility. The BFF must authorize each label and enforce the upstream contract before this view is activated. The legacy `projectStreamingSnapshot` remains for earlier draft consumers.
