# Single-user test menu: durable quarantine lock (draft)

The prior 90-second Redis lock could expire while a LINE API operation was still unresolved. This isolated branch changes menu-switch and restore coordination to a **non-expiring Redis mutex**, guarded by SET NX and token-check Lua release.

- A clean, verified operation releases the lock atomically only when the owner token matches.
- If LINE POST times out, verification fails, journal integrity cannot be confirmed, or an exception occurs, the lock remains and all subsequent menu mutation requests are rejected.
- The journal and snapshot remain in staging Redis.
- There is deliberately **no automatic unlock, retry, bypass flag or unlock endpoint**. A human must use the read-only recovery inspector and independently review what LINE currently shows before deciding how to proceed.

## Important remaining risk
Redis and LINE cannot participate in one atomic transaction. A permanent mutex plus write-ahead record reduces reentry hazards but DOES NOT guarantee external atomicity, nor prevent an unrelated operator or the existing production bot from writing through a different integration. Redis loss, manual edits, concurrent external modifications and interrupted writes still require a documented, safe manual recovery procedure. The implementation must not be enabled until this is completed and reviewed.

This branch does not expose new admin actions, deploy to Vercel, install a LINE access token, or modify the production webhook.
