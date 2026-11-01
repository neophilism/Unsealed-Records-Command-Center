# Production deployment boundary

This unit packages the production BFF after its reviewed application source is merged. At the initial URC-03 snapshot `8fd4d2ba518782b4040f867ace4699582f799f3d`, this branch contains no application or frontend build. PR #7 (URC-02) is an unmerged dependency. Do not deploy this branch as a working Command Center or substitute an anonymously accessible static dashboard. No service, domain, database, paid fallback or deployment was created by these changes.

The container runs as the unprivileged Node user. Its build context allows only the BFF modules and the two startup scripts; environment files, tests, registry records and local membership data are excluded. The base image tag must be resolved and its digest retained as release evidence when a build runtime is available. The current environment has no Docker executable, so no container build or image scan has been verified.

## Runtime configuration

`node scripts/start-production.mjs` validates the complete configuration before loading `src/bff/main.mjs`. Missing application source or invalid configuration refuses startup without printing secret values. Configure these as server runtime inputs, never frontend build arguments:

| Input | Requirement |
| --- | --- |
| `APP_ORIGIN` | Canonical HTTPS origin of this app |
| `ENGINE_ORIGIN` | Approved Engine HTTPS origin without credentials, query or path |
| `ENGINE_TOKEN` | Server-only scoped Engine credential |
| `BFF_ISSUER`, `BFF_AUDIENCE` | Verified issuer and dashboard audience |
| `BFF_JWKS_JSON` | Single-line public RSA signing JWK set; no private key material; unique key IDs; minimum 2048-bit modulus |
| `BFF_SESSION_KEY_BASE64` | Canonical base64 encoding of exactly 32 cryptographically random bytes; do not use test fixtures |
| `BFF_MEMBERSHIP_FILE` | Absolute path to private mode-0600 regular membership file, refreshed before expiry; mount through an approved existing secret/persistent configuration mechanism |
| `BFF_REPORT_ROUTES_JSON` | Explicit verified Engine report route templates; no arbitrary destination URLs |
| `OIDC_AUTHORIZATION_ENDPOINT`, `OIDC_TOKEN_ENDPOINT`, `OIDC_CLIENT_ID` | Trusted HTTPS issuer account configuration |
| `OIDC_REDIRECT_URI` | Exact `APP_ORIGIN` plus `/auth/callback`; register this URI at the issuer |
| `PORT` | Optional integer 1–65535; default 3000 |

Use the hosting provider's existing TLS termination and route `/auth/*`, `/api/*`, and `/healthz` to this BFF. Never put `/api/*` behind a public static fallback or CDN cache. Set provider health to `/healthz`; that liveness response does not establish provider credentials, authorized data access or overall production acceptance. A missing/stale membership file blocks startup; later revocation and expiry must be enforced by the BFF on every report request. Keep current membership synchronized across all replicas before declaring revocation global.

No Render Blueprint is applied and no new plan or instance size is selected here. The committed deployment monitor at the initial snapshot lists `deployments:[]`, a zero monthly budget and disabled billable fallback. A configured live service/account must be independently verified before changing production routing.

## Verification

Run `node --test tests/production-*.test.mjs` for configuration, redaction, unauthorized-route and real loopback HTTP tests. These tests use generated keys, local files and fixture endpoints; they do not contact a live issuer or Engine.

After the BFF dependency is merged, build this container and record its immutable image digest and commit, scan it, provide runtime secrets through the hosting control plane, and confirm the service is private until smoke checks pass. Run:

```sh
node scripts/production-smoke.mjs https://YOUR-APP-ORIGIN VERIFIED_LABEL_ID VERIFIED_REPORT_NAME
```

The smoke command never sends a token. It requires a valid minimal health response, `401` for `/api/session`, and `401` or `403` for the configured report. Redirects, public metrics, route `404`s, verbose error bodies, cacheable responses, oversized bodies and timeouts fail. All requests share one bounded deadline. The result explicitly says `anonymous-boundary-only`: authenticated login, tenant isolation, upstream source correctness, frontend accessibility and live production monitoring remain separate acceptance checks. Never infer those from this smoke test.

After actual deployment, record the origin, commit/image digest, exact check evidence and authenticated/wrong-label journeys without tokens or personal membership data. Do not mark URC-03 complete until the application, issuer, Engine contract and deployed routes are verified.
