# URC-10 SceneSignal privacy boundary

The session projection validates label, event/session IDs, lifecycle state, exact count and commerce strings, source revision and observation time. It omits participant IDs and exact location. Attendance, engagements and commerce values below the configured group threshold are suppressed; the default is 10. It rejects stale revisions and backward lifecycle transitions. The same-origin client discards results from an earlier label scope and carries no provider credential.

Run `node --test tests/scenesignal-session.test.mjs tests/scenesignal-client.test.mjs` for privacy threshold, scope, source version and lifecycle checks.

These are read-only aggregates. No SceneSignal provider connector, attendance proof, consent policy, retention schedule or production anonymization audit has been verified. The BFF must enforce user grants and source authentication before any live view is exposed. A threshold alone does not establish formal anonymity. The legacy `projectSceneSignalSession` remains for earlier draft consumers.
