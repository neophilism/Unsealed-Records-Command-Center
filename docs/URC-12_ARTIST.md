# URC-12 artist portfolio boundary

The server-side projection first reconciles all exact minor-unit royalty allocations and 10,000 basis points in each source statement. It then reveals only the requested artist's share, keeping other artists' IDs and amounts out of the client response. Negative adjustments remain signed decimal strings. Portfolio totals stay separated by release and currency; they are not spendable balances or payout commitments.

The same-origin client accepts only projected artist statements. It rejects raw cross-artist allocations, wrong label/artist data, older revisions and responses from an earlier scope. Run `node --test tests/artist-royalties.test.mjs tests/artist-client.test.mjs`.

No authenticated artist account, source royalty ledger, payout reconciliation, split contract or Music Operations Engine API has been verified in this repository. The BFF must derive artist identity and label access from a trusted session, authenticate source statements and perform the projection on the server. The legacy `projectArtistRoyalty` remains for earlier draft consumers.
