# URC-08 Stems White Label commerce boundary

Pure verified-offer projector only; no provider account, live catalog, checkout, payment authorization, order status, settlement or purchase integration exists. A backend must validate product rights and independently verify label ownership and provider provenance. Disclose currency and taxes, preserve exact minor-unit amounts, authenticate transaction requests, prevent replay and cross-label ordering, and test cancellation/refund flow before selling anything. Never put provider credentials in the browser.
