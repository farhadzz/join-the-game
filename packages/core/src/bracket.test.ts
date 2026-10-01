import { describe, expect, it } from 'vitest';
import {
  bracketChampion,
  generateKnockoutBracket,
  resolveBracket,
  seedOrder,
  type BracketSlot,
} from './bracket';

const teams = (count: number) => Array.from({ length: count }, (_, i) => `t${i + 1}`);

const label = (slot: BracketSlot) =>
  slot.kind === 'team' ? slot.teamId : slot.kind === 'bye' ? 'bye' : `W(${slot.matchId})`;

const firstRound = (teamCount: number) =>
  generateKnockoutBracket(teams(teamCount))
    .matches.filter((m) => m.round === 1)
    .map((m) => `${label(m.home)} v ${label(m.away)}`);

describe('seedOrder', () => {
  it('places seeds so the top two can only meet in the final', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('generateKnockoutBracket', () => {
  it('rejects fewer than two teams', () => {
    expect(() => generateKnockoutBracket(['t1'])).toThrow('At least 2 teams');
  });

  it('pairs highest against lowest seed in a full bracket', () => {
    expect(firstRound(8)).toEqual(['t1 v t8', 't4 v t5', 't2 v t7', 't3 v t6']);
  });

  it('gives byes to the top seeds when the count is not a power of two', () => {
    expect(firstRound(6)).toEqual(['t1 v bye', 't4 v t5', 't2 v bye', 't3 v t6']);
  });

  it('never pairs two byes', () => {
    for (let count = 2; count <= 33; count++) {
      expect(firstRound(count)).not.toContain('bye v bye');
    }
  });

  it('builds log2 rounds with halving match counts', () => {
    const bracket = generateKnockoutBracket(teams(5));
    expect(bracket.roundCount).toBe(3);
    const perRound = [1, 2, 3].map((r) => bracket.matches.filter((m) => m.round === r).length);
    expect(perRound).toEqual([4, 2, 1]);
  });

  it('feeds each later match from two adjacent earlier matches', () => {
    const final = generateKnockoutBracket(teams(4)).matches.find((m) => m.round === 2);
    expect(final && [label(final.home), label(final.away)]).toEqual(['W(r1m1)', 'W(r1m2)']);
  });
});

describe('resolveBracket', () => {
  it('advances teams with a bye automatically', () => {
    const bracket = generateKnockoutBracket(teams(3));
    const resolved = resolveBracket(bracket, new Map());
    expect(resolved.get('r1m1')).toEqual({
      homeTeamId: 't1',
      awayTeamId: null,
      winnerTeamId: 't1',
      isBye: true,
    });
    expect(resolved.get('r2m1')?.homeTeamId).toBe('t1');
    expect(resolved.get('r2m1')?.awayTeamId).toBeNull();
  });

  it('carries winners through to the final and champion', () => {
    const bracket = generateKnockoutBracket(teams(4));
    const resolved = resolveBracket(
      bracket,
      new Map([
        ['r1m1', 't4'],
        ['r1m2', 't2'],
        ['r2m1', 't2'],
      ]),
    );
    expect(resolved.get('r2m1')).toMatchObject({ homeTeamId: 't4', awayTeamId: 't2' });
    expect(bracketChampion(bracket, resolved)).toBe('t2');
  });

  it('has no champion until the final is decided', () => {
    const bracket = generateKnockoutBracket(teams(4));
    const resolved = resolveBracket(bracket, new Map([['r1m1', 't1']]));
    expect(bracketChampion(bracket, resolved)).toBeNull();
  });

  it('ignores a winner who is not playing in that match', () => {
    const bracket = generateKnockoutBracket(teams(4));
    const resolved = resolveBracket(bracket, new Map([['r1m1', 't2']]));
    expect(resolved.get('r1m1')?.winnerTeamId).toBeNull();
  });
});
