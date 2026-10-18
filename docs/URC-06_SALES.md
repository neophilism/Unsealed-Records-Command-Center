# URC-06 storefront sales boundary

The normalized event model distinguishes sale, discount, refund and fee events. It keeps amounts as exact decimal strings in currency minor units, selects the highest source revision per event, rejects duplicate conflicts and over-refunds, and groups order dimensions by currency, storefront and country. It reports gross, discounts, refunds, fees, settled net and pending net separately per currency. Empty selections are awaiting data rather than zero revenue; synthetic events remain explicitly synthetic. Settled net is a transaction-status view, not a claim of accounting recognition.

The same-origin sales client reads `/api/labels/{labelId}/reports/sales` through the authenticated BFF, carries no provider credential, rejects wrong-label or older source data, and discards old in-flight results after a label switch. Run `node --test tests/storefront-sales.test.mjs tests/sales-client.test.mjs`.

No processor, distributor, or Music Operations Engine sales contract has been verified in this repository. Taxes, multi-currency conversion, payout reconciliation and revenue recognition are not implemented. Server-side authentication, provider authorization and signed source evidence remain required before exposing financial data. The legacy `projectStorefrontSale` helper remains for earlier draft consumers.
