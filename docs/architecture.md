# Architecture and Engineering Decisions

## Source Layout

`apps/crm` follows responsibility-based folders without an additional architecture layer:

- `app/` contains Next.js routes, layouts, global styles, and thin page entrypoints.
- `components/<domain>/` contains screen implementations and domain-specific client adapters.
- `components/layout/` contains the application shell; `components/ui/` contains reusable primitives.
- `lib/<domain>/` contains server-side business logic. `lib/core/` is limited to shared infrastructure.
- `tests/unit/` mirrors server domains; `tests/integration/` covers workflows across boundaries.
- `prisma/`, `scripts/`, and `e2e/` contain database, operational, and browser-test concerns respectively.

Route files may validate transport input and shape responses. Reusable business behavior belongs in `lib/`, while reusable rendering and browser data access belong in `components/`.

## System Boundaries

- The Next.js CRM owns identities, customers, segments, campaigns, experiments, decisions, audits, and analytics.
- PostgreSQL is the business source of truth and enforces uniqueness for campaign recipients and receipt events.
- Redis owns transient rate-limit counters, cached campaign statistics, BullMQ jobs, dead letters, and live event fan-out.
- The Hono channel service simulates a provider and signs every callback with HMAC-SHA256.

## Decision Engine

`rfm-v1` is deterministic and explainable. It combines:

- Recency decay over 120 days.
- Log-normalized purchase frequency.
- Log-normalized lifetime value.
- Churn risk derived from inactivity and repeat behavior.

The output includes conversion probability, expected revenue, churn risk, channel, send hour, and four plain-language reasons. Snapshots are stored on `CampaignMessage`, preventing later model changes from rewriting historical decisions.

A trained classifier was rejected for this version. Five hundred synthetic customers and a few attributed conversions cannot support defensible train/test splits or stable calibration.

## Measurement

- Offline ranking benchmark: deterministic top-k versus deterministic random-k. Useful for regression testing, not causal inference.
- Online experiment: stable 50/50 control/treatment assignment. Conversion difference uses a pooled two-proportion z-test and a 95% confidence threshold.
- Revenue and precision are always shown beside sample size to reduce misleading percentage-only claims.

## Security

- NextAuth JWT sessions carry database-backed roles and organization IDs. Login requires a workspace slug.
- Analysts can read decision and analytics data. Marketers can create segments and campaigns. Administrators can import customers, inspect audits, and retry dead letters.
- Passwords use Argon2id; the legacy SHA-256 authentication fallback has been removed.
- Receipt callbacks use timing-safe HMAC verification over the exact request body.
- AI and receipt routes use Redis-backed fixed-window limits.
- Secrets are loaded from ignored environment files and never returned to the browser.

## Reliability

- Campaign launch uses a Redis lock, an atomic status claim, database uniqueness, and BullMQ job IDs.
- Provider sends use `CampaignMessage.id` as an idempotency key cached by the channel service.
- Delivery jobs retry three times with exponential backoff.
- Exhausted jobs enter `campaign-dead-letter`; only administrators can retry them, and every retry is audited.
- Receipt writes are batched, deduplicated, and monotonic. Late events cannot regress message state.
- A dedicated WebSocket gateway consumes Redis pub/sub. Browsers receive one-minute HMAC subscription tokens after tenant-scoped campaign authorization.

## Remaining Production Work

- Replace synthetic training data with real, consented, time-split outcomes before treating model quality as production evidence.
- Use a dedicated event gateway when concurrent SSE connections exceed the Next.js deployment model.
- Configure real provider rate cards, alert destinations, commerce signing secrets, and deployment credentials.
