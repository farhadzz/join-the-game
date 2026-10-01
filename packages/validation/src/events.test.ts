import { sports } from '@join-the-game/core';
import { describe, expect, it } from 'vitest';
import { matchEventSchema, matchEventSchemaFor, type MatchContext } from './events';

/** Deterministic, valid v4 UUIDs. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const context: MatchContext = {
  matchId: uuid(1),
  homeTeamId: uuid(2),
  awayTeamId: uuid(3),
  sport: sports.football,
};

const base = {
  id: uuid(4),
  matchId: context.matchId,
  seq: 1,
  period: 1,
  clockMs: 1_000,
  recordedAt: '2026-01-01T10:00:00.000Z',
  recordedBy: uuid(5),
};

const score = (points: number, teamId = context.homeTeamId) => ({
  ...base,
  type: 'score',
  payload: { teamId, points },
});

const foul = (kind: string) => ({
  ...base,
  type: 'foul',
  payload: { teamId: context.awayTeamId, kind },
});

const issuePaths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.'));

describe('matchEventSchema', () => {
  it('accepts a valid event', () => {
    expect(matchEventSchema.safeParse(score(1)).success).toBe(true);
  });

  it('accepts an optional playerId and server receivedAt', () => {
    const event = {
      ...score(1),
      receivedAt: '2026-01-01T10:00:01+02:00',
      payload: { teamId: context.homeTeamId, points: 1, playerId: uuid(6) },
    };
    expect(matchEventSchema.safeParse(event).success).toBe(true);
  });

  it('rejects an unknown event type', () => {
    expect(matchEventSchema.safeParse({ ...base, type: 'timeout', payload: {} }).success).toBe(
      false,
    );
  });

  it('rejects a payload that does not match the type', () => {
    const result = matchEventSchema.safeParse({ ...base, type: 'void', payload: {} });
    expect(issuePaths(result)).toEqual(['payload.targetEventId']);
  });

  it('rejects unexpected fields', () => {
    expect(matchEventSchema.safeParse({ ...score(1), extra: true }).success).toBe(false);
    expect(
      matchEventSchema.safeParse({ ...base, type: 'match_started', payload: { x: 1 } }).success,
    ).toBe(false);
  });

  it.each([
    ['id', 'not-a-uuid'],
    ['seq', 0],
    ['seq', 1.5],
    ['period', 0],
    ['clockMs', -1],
    ['recordedAt', 'yesterday'],
  ])('rejects an invalid %s', (field, value) => {
    const result = matchEventSchema.safeParse({ ...score(1), [field]: value });
    expect(issuePaths(result)).toEqual([field]);
  });

  it('allows a null clockMs', () => {
    expect(matchEventSchema.safeParse({ ...score(1), clockMs: null }).success).toBe(true);
  });
});

describe('matchEventSchemaFor', () => {
  const football = matchEventSchemaFor(context);
  const basketball = matchEventSchemaFor({ ...context, sport: sports.basketball });

  it('accepts score values allowed by the sport', () => {
    expect(football.safeParse(score(1)).success).toBe(true);
    expect(basketball.safeParse(score(3)).success).toBe(true);
  });

  it('rejects score values the sport does not allow', () => {
    const result = football.safeParse(score(3));
    expect(issuePaths(result)).toEqual(['payload.points']);
    expect(result.error?.issues[0]?.message).toBe('A football score must be worth 1');
  });

  it('rejects foul kinds from another sport', () => {
    expect(football.safeParse(foul('yellow')).success).toBe(true);
    expect(issuePaths(football.safeParse(foul('technical')))).toEqual(['payload.kind']);
    expect(issuePaths(basketball.safeParse(foul('red')))).toEqual(['payload.kind']);
  });

  it('rejects a team that is not in the match', () => {
    expect(issuePaths(football.safeParse(score(1, uuid(7))))).toEqual(['payload.teamId']);
  });

  it('rejects an event for another match', () => {
    const result = football.safeParse({ ...score(1), matchId: uuid(8) });
    expect(issuePaths(result)).toEqual(['matchId']);
  });

  it('applies no sport rules to events without a team', () => {
    const periodStarted = { ...base, type: 'period_started', payload: { kind: 'shootout' } };
    expect(football.safeParse(periodStarted).success).toBe(true);
  });
});
