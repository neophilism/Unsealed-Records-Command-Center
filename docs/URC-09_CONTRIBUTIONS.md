# URC-09 TrackZero contributor boundary

The read-only event projection requires a verified, eligible completed occurrence before showing earned points, and a confirmed redemption before showing spent points. It keeps exact decimal micro-points separate by creator and artist, rejects conflicting event replays and duplicate earned occurrences, and never pools artists' balances. Synthetic and observed records remain distinct. No microphone measurement or points issuance occurs here.

The same-origin client reads `/api/labels/{labelId}/reports/trackzero` through the authenticated BFF. It sends no provider key or creator selector; the server must derive the creator from its verified session. It rejects wrong creator/label responses and stale or superseded requests. Run `node --test tests/speaker-contributions.test.mjs tests/trackzero-client.test.mjs`.

No live TrackZero verified event contract, acoustic calibration, anti-fraud proof, or authorized provider integration has been verified. Caller-supplied verification flags are not proof. The BFF must independently validate source evidence and eligibility before returning events. The legacy `projectContribution` remains for earlier draft consumers.
