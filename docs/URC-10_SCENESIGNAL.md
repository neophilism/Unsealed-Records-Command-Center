# URC-10 SceneSignal scoped session projection

This is a restricted projection validator, not a working authenticated event/session integration. It excludes participant IDs and exact location in the exposed view. A boolean sourceVerified is only an asserted precondition; a trusted backend must establish identity, role and upstream event provenance. Real integration needs late/out-of-order event handling, state revisions, PII minimization, aggregation thresholds, E2E isolation tests and a consent-reviewed retention policy. Do not infer attendance from event metadata.
