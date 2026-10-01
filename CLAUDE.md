# Competition App — Project Context

## Purpose
Portfolio flagship project for Farhad (frontend/mobile dev: React, TypeScript, React Native).
Goal: land remote international roles. The app must look and behave like production software,
and the repo itself is part of the portfolio (clean README, CI, tests, readable commits).

## Product
Users create and run sports competitions (basketball, football first).
Angle: amateur leagues / local tournaments, with **live offline-capable scorekeeping** as the standout feature.
Not trying to compete feature-for-feature with Challonge/Toornament.

### MVP scope
1. Create a competition: sport, format (knockout or league), teams
2. Auto-generate fixtures / bracket
3. Live scorekeeper mode: big buttons, works offline, event log (goal, point, foul, period)
4. Live standings + bracket view, updating in real time
5. Public shareable spectator link (web, no install)
6. Invite co-organizers / scorekeepers by link

### Later (v2)
Web organizer dashboard, player stats & leaderboards, double elimination, push notifications,
home-screen widget for live score, pluggable sport-specific rules.

### Roles
organizer, scorekeeper/referee, team captain, player, spectator.

## Key architecture decision
Store **match events** (goal at 12:34, foul, substitution), not just final scores.
Derive scores, standings, and stats from events. Benefits: easier offline sync,
free undo, audit trail.

## App split (decided)
- **Mobile (Expo)**: organizers, scorekeepers, captains, players. Competition setup,
  offline live scorekeeping, invites. Native because offline reliability matters
  (SQLite, keep-awake, haptics; mobile Safari can evict IndexedDB).
- **Web (Next.js)**: spectators only, read-only, no login. Live scores, standings, bracket
  via shared link. Mobile-first responsive; installable PWA.
- Web organizer dashboard deferred to v2. Both apps share `core`, `validation`, `api`.

## Match event schema (decided)
Common fields on every event:
```ts
type MatchEvent = {
  id: string;             // client-generated UUID (idempotent sync)
  matchId: string;
  seq: number;            // per-match counter; the source of truth for ordering
  type: EventType;
  period: number;
  clockMs: number | null; // game clock at time of event
  recordedAt: string;     // device time, informational only (clocks drift)
  receivedAt?: string;    // set by server on sync
  recordedBy: string;     // user id
  payload: /* per type */;
};
```

| Type | Payload | Notes |
|---|---|---|
| `match_started` | — | |
| `period_started` | `kind: 'regular' \| 'overtime' \| 'shootout'` | |
| `period_ended` | — | |
| `clock_started` / `clock_stopped` | — | Game clock is derived from these |
| `score` | `teamId`, `points`, `playerId?` | Football: 1. Basketball: 1/2/3 |
| `foul` | `teamId`, `playerId?`, `kind` | personal/technical (basketball), yellow/red (football) |
| `match_ended` | — | |
| `void` | `targetEventId` | Undo; events are never deleted |

Rules:
- Order by `seq`, never by timestamps.
- Score = sum of non-voided `score` events in non-shootout periods.
- Shootout scores are tallied separately and only decide the winner of a drawn knockout match.
- MVP tracks teams only; `playerId` is optional so v2 player stats need no migration.
- Sport-specific validation (allowed points, foul kinds) lives in Zod schemas in `packages/validation`.

## Repo: single monorepo (FE + BE together)
```
join-the-game/
├── apps/
│   ├── mobile/        # Expo (Expo Router)
│   └── web/           # Next.js (spectator pages; organizer dashboard in v2)
├── packages/
│   ├── core/          # bracket, fixtures, standings logic + tests
│   ├── db-types/      # generated Supabase types
│   ├── api/           # typed client, TanStack Query hooks
│   ├── validation/    # Zod schemas
│   └── ui/            # shared components (optional)
├── supabase/
│   ├── migrations/
│   ├── functions/     # Edge Functions
│   └── seed.sql
├── turbo.json
└── package.json
```

## Stack
- Turborepo, TypeScript strict everywhere
- Mobile: Expo + Expo Router, Reanimated, EAS Build/Update
- Web: Next.js
- Styling: NativeWind (Tailwind) on mobile; Tailwind on web
- No shared navigation layer (no Solito) — apps don't share screens
- Backend: Supabase only (Postgres, auth, realtime, row-level security for roles).
  Add a custom API (e.g. Hono) only if a concrete need appears.
- Offline: expo-sqlite on scorekeeper device with an outbox queue. Events are append-only,
  get client-generated UUIDs, and are inserted idempotently on sync.
  MVP: one active scorekeeper per match (avoids conflicts).
- Data: TanStack Query, Zod shared across apps
- Testing: Vitest/Jest for core logic, Maestro for mobile E2E
- Monitoring: Sentry

## Quality bar
Auth, loading/error/empty states, accessibility labels, dark mode, tests for core logic,
CI on every PR, descriptive commits, good README with screenshots and architecture notes.

## Open questions
- None currently.
