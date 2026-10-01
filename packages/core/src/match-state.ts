import { activeEvents, type MatchEvent, type PeriodKind } from './events';

export type MatchSides = { homeTeamId: string; awayTeamId: string };

export type TeamTally = { home: number; away: number };

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type ClockState = {
  running: boolean;
  /** Elapsed period time at the last start/stop. */
  elapsedMs: number;
  /** Device time the clock was last started, while running. */
  runningSince: string | null;
};

export type MatchState = {
  status: MatchStatus;
  period: number | null;
  periodKind: PeriodKind | null;
  periodInProgress: boolean;
  score: TeamTally;
  /** Tallied separately; only decides a drawn match. */
  shootout: TeamTally;
  fouls: TeamTally;
  clock: ClockState;
  /** Set once the match is finished and not drawn. */
  winnerTeamId: string | null;
};

const stoppedClock: ClockState = { running: false, elapsedMs: 0, runningSince: null };

function stopClock(clock: ClockState, clockMs: number | null, recordedAt: string): ClockState {
  if (!clock.running) return clock;
  const elapsedMs =
    clockMs ??
    clock.elapsedMs +
      Math.max(0, Date.parse(recordedAt) - Date.parse(clock.runningSince ?? recordedAt));
  return { running: false, elapsedMs, runningSince: null };
}

/** Elapsed period time at `now` (ms since epoch). */
export function clockElapsedMs(clock: ClockState, now: number): number {
  if (!clock.running || clock.runningSince === null) return clock.elapsedMs;
  return clock.elapsedMs + Math.max(0, now - Date.parse(clock.runningSince));
}

export function deriveMatchState(sides: MatchSides, events: readonly MatchEvent[]): MatchState {
  const active = activeEvents(events);

  const periodKinds = new Map<number, PeriodKind>();
  for (const event of active) {
    if (event.type === 'period_started') periodKinds.set(event.period, event.payload.kind);
  }

  const sideOf = (teamId: string): keyof TeamTally | null =>
    teamId === sides.homeTeamId ? 'home' : teamId === sides.awayTeamId ? 'away' : null;

  const state: MatchState = {
    status: 'scheduled',
    period: null,
    periodKind: null,
    periodInProgress: false,
    score: { home: 0, away: 0 },
    shootout: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    clock: stoppedClock,
    winnerTeamId: null,
  };

  for (const event of active) {
    switch (event.type) {
      case 'match_started':
        state.status = 'live';
        break;
      case 'period_started':
        state.period = event.period;
        state.periodKind = event.payload.kind;
        state.periodInProgress = true;
        state.clock = stoppedClock;
        break;
      case 'period_ended':
        state.periodInProgress = false;
        state.clock = stopClock(state.clock, event.clockMs, event.recordedAt);
        break;
      case 'clock_started':
        if (!state.clock.running) {
          state.clock = {
            running: true,
            elapsedMs: event.clockMs ?? state.clock.elapsedMs,
            runningSince: event.recordedAt,
          };
        }
        break;
      case 'clock_stopped':
        state.clock = stopClock(state.clock, event.clockMs, event.recordedAt);
        break;
      case 'score': {
        const side = sideOf(event.payload.teamId);
        if (side === null) break;
        const tally = periodKinds.get(event.period) === 'shootout' ? state.shootout : state.score;
        tally[side] += event.payload.points;
        break;
      }
      case 'foul': {
        const side = sideOf(event.payload.teamId);
        if (side !== null) state.fouls[side] += 1;
        break;
      }
      case 'match_ended':
        state.status = 'finished';
        state.periodInProgress = false;
        state.clock = stopClock(state.clock, event.clockMs, event.recordedAt);
        break;
      case 'void':
        // Already applied by activeEvents.
        break;
    }
  }

  if (state.status === 'finished') {
    state.winnerTeamId = decideWinner(sides, state.score) ?? decideWinner(sides, state.shootout);
  }

  return state;
}

function decideWinner(sides: MatchSides, tally: TeamTally): string | null {
  if (tally.home > tally.away) return sides.homeTeamId;
  if (tally.away > tally.home) return sides.awayTeamId;
  return null;
}

/** Clock text as the sport displays it: elapsed for football, remaining for basketball. */
export function formatClock(
  elapsedMs: number,
  periodDurationMs: number,
  direction: 'up' | 'down',
): string {
  const shownMs = direction === 'up' ? elapsedMs : Math.max(0, periodDurationMs - elapsedMs);
  const totalSeconds = direction === 'up' ? Math.floor(shownMs / 1000) : Math.ceil(shownMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
