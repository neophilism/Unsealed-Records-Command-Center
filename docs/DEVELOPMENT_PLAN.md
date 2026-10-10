# Unsealed Records Command Center — complete recovered development plan and cross-account handoff

**Recovery source:** October 9, 2026 project conversation plus [original PR roadmap](https://github.com/neophilism/Unsealed-Records-Command-Center/blob/feature/phase-1-foundation/docs/roadmap.md). The first 15 milestone scopes were preserved, plus approved **item 16** for multi-label/family reporting. Milestone IDs are not GitHub PR numbers. Descriptive scopes/acceptance below supplement the original source, not verbatim quoted chat.

## Product and architecture

Brand-specific responsive music operations dashboard, consuming the authenticated Music Operations Engine API as a separate user-facing web app. No independent data-provider ingest, financial ledger or event processing in the frontend. Development demo data is not live operational data.

## Recovered non-negotiable requirements

- Separate from the steampunk Engine Room project tracker: this dashboard is for commercial music business, releases, performance, catalog and related live events.
- Use label/family/all-authorized-label selector; selection must refresh all views safely and prevent old in-flight reports from leaking across scopes.
- TrackZero and SceneSignal each get a dedicated view and feed aggregated overview when permitted; exact contributor points earned/spent are artist-specific and never pooled.
- Operational dashboards require a production authentication/BFF server and server-kept API credentials; a static public Vite preview may not expose metrics anonymously.
- Show clear separate states for live source results, cached observed data, awaiting producers, and explicitly synthetic demo. Never relabel cached facts as synthetic or synthetic as live.
- External provider integrations belong in the underlying Music Operations Engine.

## Original 15 milestones and approved 16th addition

### URC-01 — Responsive premium dashboard foundation

- **Deliver:** High-quality label KPIs, release rankings, streaming, sales, event and source provenance; synthetic demo marked.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-02 — Production backend-for-frontend and identity

- **Deliver:** Server-side engine proxy, user login, per-label role checks and no browser API keys.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-03 — Production deployment and routing

- **Deliver:** Render web service/domain, runtime config, CI/health, no public operational data without access.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-04 — Label catalog identity

- **Deliver:** Work/release metadata, track ISRC, artwork and owning-label groupings.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-05 — Streaming insights

- **Deliver:** Period/country/platform filters, source latency, historical and current snapshots.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-06 — Storefront sales dashboards

- **Deliver:** Storefront, geography, refunds, fees, pending vs settled recognized income.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-07 — TooLost statement drill-down

- **Deliver:** Authenticated distributor reconciliation and source evidence via backend.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-08 — Stems White Label commerce

- **Deliver:** Licenses and purchase receipts, entitlement and creator income breakdown.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-09 — TrackZero speaker contributions

- **Deliver:** Listening, artist earned/spent points, rewards and verification status.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-10 — SceneSignal event/session insights

- **Deliver:** Concerts, contributor and artist performances, attendance, engagement and commerce.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-11 — Event calendar/QR street launches

- **Deliver:** On-site campaigns, QR attribution, attendance, privacy and artist outreach.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-12 — Artist portfolio and royalties

- **Deliver:** Aggregated views across projects, normalized splits and artist statements.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-13 — Goals, anomaly alerts and source health

- **Deliver:** Source outage alerts, tracked KPIs, thresholds and reconciliations.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-14 — Drill-downs, exports and audit

- **Deliver:** View-level and event-level provenance, CSV exports and audit of privileged actions.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-15 — Roles, mobile quality and production acceptance

- **Deliver:** User/admin scopes, accessibility, load/performance, auth/privacy review, actual production smoke.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

### URC-16 — Added label/family/all-label scopes and platform views (approved additional scope)

- **Deliver:** Authorized scope menus, aggregate reporting and combined TrackZero/SceneSignal panels already included in proposed foundation PR #1.
- **Dependencies:** All upstream domain/API contracts must already pass tests; provider-sensitive screens wait for real adapter data and documented permission.
- **Acceptance:** Isolated, repeatable tests for correct data, wrong tenant/label, absent/late/out-of-order sources, expired token, failure/retry and safe rendering. Check exact large-number handling, source provenance, accessibility where applicable, and no API secret in frontend bundles.

## Original source document, retained here for audit

The following is the verified original checked-in roadmap text, for auditing exact historical scope. It is currently committed on the PR #1 branch, not necessarily on the default branch.

---

# Command Center PR roadmap — Unsealed Records use case

1. Premium label-specific responsive shell, release leaderboard, KPI dashboard and source provenance with explicit synthetic demo mode (this implementation).
2. Secure server-side backend-for-frontend gateway and first-admin provisioning; deny anonymous operational metrics.
3. Production routing/deployment via existing Render workspace without exposing Engine API credentials.
4. Label catalog identities, track ISRCs, release metadata and artwork.
5. Streaming insights with period filters, source latency and freshness.
6. Sales by storefront and country, refunds and recognized vs pending settlements.
7. TooLost importer with verified schema, payouts and reconciliation.
8. Stems White Label sales and commercial license dashboards.
9. TrackZero listening, speaker rewards and artist activation insights.
10. SceneSignal venue/event insights, attendance and engagement.
11. Direct event calendar, QR campaign attribution and offline street launch tracking.
12. Artist portfolio, royalty allocations and revenue splits.
13. Alerts and performance goals, source outage health indicators.
14. Drill-downs, CSV exports and audit logs.
15. Access roles, mobile polish, accessibility/performance audit and production acceptance.
16. Added scope: authorized label/family/all-label menu and aggregated platform reporting (implemented in foundation PR #1 alongside the engine's PRs #2–#3).

TrackZero and SceneSignal reporting tabs from milestones 9–10 now consume the engine's platform metrics. Live telemetry, full analytics drill-downs and production account access remain outstanding. The foundation PR is a development dashboard, not a production authentication gateway.

The Command Center never stores or implements third-party provider integrations: those belong in the Music Operations Engine.



---

## Cross-account current-state procedure

1. Inspect actual GitHub merged and open PRs, CI, application code, source schemas, migrations, deployed Render/Neon services and Engine Room record. **Do not equate PR number with planned stage or trust stale conversation status.**
2. Verify upstream/downstream boundaries. **PR #1 is a separate open development branch in the historical recovery check.** Merge only after checking CI, branch conflicts, upstream dependencies and proper authentication; default branch alone may contain only the README.
3. Maintain stable URC-01..16 roadmap IDs and map actual PRs + live provider/tenant/deployment evidence independently. Mark planned not complete until tested and merged. Never count mock dashboards or CSV examples as live integrations.
4. Chain routine tested PRs and deploy where access exists. Stop for unavailable provider credentials, privacy/rights decisions, genuine product direction changes, conflicts or failed quality gates.
5. Before calling it production: scoped auth, secrets management, at least one real consumer/provider feed, replay-safe reconciliation, backups, failure alerts, accessibility, and live monitored dashboard/source freshness must all be verified.

## Recovery confidence

The original roadmap source, full 15-item sequence and 16th approved scope are recovered. Additional implementation acceptance language is authored guidance; current live operational status is not implied by documentation.
