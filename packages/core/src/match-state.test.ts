import { describe, expect, it } from 'vitest';
import { activeEvents } from './events';
import { clockElapsedMs, deriveMatchState, formatClock } from './match-state';
import { eventLog } from './test-utils';

const sides = { homeTeamId: 'home', awayTeamId: 'away' };

describe('activeEvents', () => {
  it('orders events by seq regardless of arrival order', () => {
    const events = eventLog([
      { type: 'match_started' },
      { type: 'score', payload: { teamId: 'home', points: 1 } },
    ]);
    expect(activeEvents([...events].reverse()).map((e) => e.seq)).toEqual([1, 2]);
  });

  it('drops duplicate events with the same id', () => {
    const events = eventLog([{ type: 'match_started' }]);
    expect(activeEvents([...events, ...events])).toHaveLength(1);
  });

  it('removes voided events and the void itself', () => {
    const events = eventLog([
      { type: 'score', payload: { teamId: 'home', points: 1 } },
      { type: 'void', payload: { targetEventId: 'e1' } },
    ]);
    expect(activeEvents(events)).toEqual([]);
  });

  it('restores an event when its void is voided', () => {
    const events = eventLog([
      { type: 'score', payload: { teamId: 'home', points: 1 } },
      { type: 'void', payload: { targetEventId: 'e1' } },
      { type: 'void', payload: { targetEventId: 'e2' } },
    ]);
    expect(activeEvents(events).map((e) => e.id)).toEqual(['e1']);
  });
});

describe('deriveMatchState', () => {
  it('starts as scheduled with zero scores', () => {
    const state = deriveMatchState(sides, []);
    expect(state.status).toBe('scheduled');
    expect(state.score).toEqual({ home: 0, away: 0 });
    expect(state.winnerTeamId).toBeNull();
  });

  it('sums points per team', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'match_started' },
        { type: 'period_started', payload: { kind: 'regular' } },
        { type: 'score', payload: { teamId: 'home', points: 3 } },
        { type: 'score', payload: { teamId: 'away', points: 2 } },
        { type: 'score', payload: { teamId: 'home', points: 1 } },
      ]),
    );
    expect(state.status).toBe('live');
    expect(state.score).toEqual({ home: 4, away: 2 });
  });

  it('ignores voided scores', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'score', payload: { teamId: 'home', points: 1 } },
        { type: 'score', payload: { teamId: 'home', points: 1 } },
        { type: 'void', payload: { targetEventId: 'e2' } },
      ]),
    );
    expect(state.score).toEqual({ home: 1, away: 0 });
  });

  it('ignores scores for teams not in the match', () => {
    const state = deriveMatchState(
      sides,
      eventLog([{ type: 'score', payload: { teamId: 'other', points: 1 } }]),
    );
    expect(state.score).toEqual({ home: 0, away: 0 });
  });

  it('counts fouls per team', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'foul', payload: { teamId: 'away', kind: 'yellow' } },
        { type: 'foul', payload: { teamId: 'away', kind: 'red' } },
      ]),
    );
    expect(state.fouls).toEqual({ home: 0, away: 2 });
  });

  it('tracks the current period', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'period_started', payload: { kind: 'regular' } },
        { type: 'period_ended' },
        { type: 'period_started', period: 2, payload: { kind: 'overtime' } },
      ]),
    );
    expect(state.period).toBe(2);
    expect(state.periodKind).toBe('overtime');
    expect(state.periodInProgress).toBe(true);
  });

  it('declares the higher score the winner when finished', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'match_started' },
        { type: 'score', payload: { teamId: 'away', points: 1 } },
        { type: 'match_ended' },
      ]),
    );
    expect(state.status).toBe('finished');
    expect(state.winnerTeamId).toBe('away');
  });

  it('leaves a level match without a winner', () => {
    const state = deriveMatchState(
      sides,
      eventLog([{ type: 'match_started' }, { type: 'match_ended' }]),
    );
    expect(state.winnerTeamId).toBeNull();
  });

  it('tallies shootout scores separately and uses them to break a draw', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'match_started' },
        { type: 'period_started', payload: { kind: 'regular' } },
        { type: 'score', payload: { teamId: 'home', points: 1 } },
        { type: 'score', payload: { teamId: 'away', points: 1 } },
        { type: 'period_ended' },
        { type: 'period_started', period: 2, payload: { kind: 'shootout' } },
        { type: 'score', payload: { teamId: 'home', points: 1 } },
        { type: 'score', payload: { teamId: 'away', points: 1 } },
        { type: 'score', payload: { teamId: 'away', points: 1 } },
        { type: 'match_ended' },
      ]),
    );
    expect(state.score).toEqual({ home: 1, away: 1 });
    expect(state.shootout).toEqual({ home: 1, away: 2 });
    expect(state.winnerTeamId).toBe('away');
  });

  it('reopens the match when match_ended is voided', () => {
    const state = deriveMatchState(
      sides,
      eventLog([
        { type: 'match_started' },
        { type: 'match_ended' },
        { type: 'void', payload: { targetEventId: 'e2' } },
      ]),
    );
    expect(state.status).toBe('live');
  });
});

describe('game clock', () => {
  const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 10, 0, seconds)).toISOString();

  it('runs from clock_started', () => {
    const { clock } = deriveMatchState(
      sides,
      eventLog([
        { type: 'period_started', payload: { kind: 'regular' } },
        { type: 'clock_started', clockMs: 0, recordedAt: at(0) },
      ]),
    );
    expect(clock.running).toBe(true);
    expect(clockElapsedMs(clock, Date.parse(at(30)))).toBe(30_000);
  });

  it('freezes at the clockMs recorded by clock_stopped', () => {
    const { clock } = deriveMatchState(
      sides,
      eventLog([
        { type: 'period_started', payload: { kind: 'regular' } },
        { type: 'clock_started', clockMs: 0, recordedAt: at(0) },
        { type: 'clock_stopped', clockMs: 12_000, recordedAt: at(12) },
      ]),
    );
    expect(clock.running).toBe(false);
    expect(clockElapsedMs(clock, Date.parse(at(59)))).toBe(12_000);
  });

  it('falls back to device time when clock_stopped has no clockMs', () => {
    const { clock } = deriveMatchState(
      sides,
      eventLog([
        { type: 'clock_started', clockMs: 5_000, recordedAt: at(0) },
        { type: 'clock_stopped', recordedAt: at(10) },
      ]),
    );
    expect(clock.elapsedMs).toBe(15_000);
  });

  it('resumes from where it stopped', () => {
    const { clock } = deriveMatchState(
      sides,
      eventLog([
        { type: 'clock_started', clockMs: 0, recordedAt: at(0) },
        { type: 'clock_stopped', clockMs: 10_000, recordedAt: at(10) },
        { type: 'clock_started', recordedAt: at(40) },
      ]),
    );
    expect(clockElapsedMs(clock, Date.parse(at(45)))).toBe(15_000);
  });

  it('resets when a new period starts', () => {
    const { clock } = deriveMatchState(
      sides,
      eventLog([
        { type: 'period_started', payload: { kind: 'regular' } },
        { type: 'clock_started', clockMs: 0, recordedAt: at(0) },
        { type: 'period_ended', clockMs: 20_000, recordedAt: at(20) },
        { type: 'period_started', period: 2, payload: { kind: 'regular' } },
      ]),
    );
    expect(clock).toEqual({ running: false, elapsedMs: 0, runningSince: null });
  });
});

describe('formatClock', () => {
  it('shows elapsed time when counting up', () => {
    expect(formatClock(754_900, 2_700_000, 'up')).toBe('12:34');
  });

  it('shows remaining time when counting down, rounding up partial seconds', () => {
    expect(formatClock(0, 600_000, 'down')).toBe('10:00');
    expect(formatClock(59_100, 600_000, 'down')).toBe('09:01');
  });

  it('stops at zero when counting down past the period length', () => {
    expect(formatClock(700_000, 600_000, 'down')).toBe('00:00');
  });

  it('keeps counting past the period length when counting up (added time)', () => {
    expect(formatClock(2_820_000, 2_700_000, 'up')).toBe('47:00');
  });
});
