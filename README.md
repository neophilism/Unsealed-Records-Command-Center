# Unsealed Records Command Center

A **separate** Unsealed Records frontend built atop the provider-agnostic [Music Operations Engine](https://github.com/neophilism/Music-Operations-Engine).

Start with Node 22+: `npm install && npm run dev`, then visit http://localhost:5173. `npm run build` produces `dist`. Without a reachable engine, the interface displays **clearly marked synthetic figures** so the UI can be reviewed safely. It never calls invented metrics real.

`/api` is proxied server-side during Vite development via `ENGINE_INTERNAL_URL`, with the API token injected only by the development server. **Do not deploy the static site against a public engine without a production backend-for-frontend and authentication** (PR 2). For production, use an authenticated server-rendered/BFF gateway; never bundle the ENGINE_API_KEY into client JavaScript or publish operational metrics anonymously.

`docs/roadmap.md` contains the planned implementation sequence.

The label menu consumes the engine's authorized `/v1/scopes` response. Choose one label, a family, or all accessible labels; the dashboard requests the matching scoped report. TrackZero and SceneSignal have their own reporting views, and their figures also appear in the aggregate overview. Canonical release rows display their title and owning label.

Use a server-side `ENGINE_READ_API_KEY` with `read` permission restricted to the appropriate labels. The development proxy supports the older `ENGINE_API_KEY` name for compatibility. The default development/preview server binds to localhost; the future production gateway needs user authentication and its own access controls.

Reports refresh every 30 seconds while open. Changing labels clears the previous report, and older in-flight results cannot replace the new selection. A connection failure preserves already-received figures as cached data; it never calls them synthetic. Missing producer data is displayed as awaiting telemetry. Engine and source app deployment remain separate steps.

`npm run build` then `npm test` verifies the built dashboard, scoped query construction, exact counters, canonical release display, selection races, cached-data provenance and absence of server credentials from the client bundle.

