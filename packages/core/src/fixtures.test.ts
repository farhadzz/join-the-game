import { describe, expect, it } from 'vitest';
import { generateRoundRobin, type Fixture } from './fixtures';

const teams = (count: number) => Array.from({ length: count }, (_, i) => `t${i + 1}`);

const pairKey = (fixture: Fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join('-');

const homeCounts = (fixtures: readonly Fixture[]) => {
  const counts = new Map<string, number>();
  for (const fixture of fixtures) {
    counts.set(fixture.homeTeamId, (counts.get(fixture.homeTeamId) ?? 0) + 1);
  }
  return counts;
};

describe('generateRoundRobin', () => {
  it('rejects fewer than two teams', () => {
    expect(() => generateRoundRobin(['t1'])).toThrow('At least 2 teams');
  });

  it('rejects duplicate team ids', () => {
    expect(() => generateRoundRobin(['t1', 't1'])).toThrow('unique');
  });

  it.each([2, 3, 4, 5, 8, 11, 16])('pairs every team exactly once with %i teams', (count) => {
    const fixtures = generateRoundRobin(teams(count));
    const pairs = fixtures.map(pairKey);
    expect(pairs).toHaveLength((count * (count - 1)) / 2);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it.each([4, 5, 8, 11])('never schedules a team twice in one round with %i teams', (count) => {
    const fixtures = generateRoundRobin(teams(count));
    const rounds = new Map<number, string[]>();
    for (const fixture of fixtures) {
      const playing = rounds.get(fixture.round) ?? [];
      playing.push(fixture.homeTeamId, fixture.awayTeamId);
      rounds.set(fixture.round, playing);
    }
    for (const playing of rounds.values()) {
      expect(new Set(playing).size).toBe(playing.length);
    }
  });

  it('uses n-1 rounds for an even count and n rounds for an odd count', () => {
    expect(Math.max(...generateRoundRobin(teams(6)).map((f) => f.round))).toBe(5);
    expect(Math.max(...generateRoundRobin(teams(5)).map((f) => f.round))).toBe(5);
  });

  it('gives each team exactly one bye with an odd count', () => {
    const fixtures = generateRoundRobin(teams(5));
    for (const team of teams(5)) {
      const roundsPlayed = new Set(
        fixtures.filter((f) => f.homeTeamId === team || f.awayTeamId === team).map((f) => f.round),
      );
      expect(roundsPlayed.size).toBe(4);
    }
  });

  it.each([3, 5, 7, 9])('balances home and away exactly with %i teams', (count) => {
    const counts = homeCounts(generateRoundRobin(teams(count)));
    for (const team of teams(count)) expect(counts.get(team)).toBe((count - 1) / 2);
  });

  it.each([4, 6, 8, 10])('keeps home and away within one with %i teams', (count) => {
    const counts = homeCounts(generateRoundRobin(teams(count)));
    for (const team of teams(count)) {
      expect(Math.abs(2 * (counts.get(team) ?? 0) - (count - 1))).toBeLessThanOrEqual(1);
    }
  });

  it('mirrors the first half with sides swapped in a double round robin', () => {
    const single = generateRoundRobin(teams(4));
    const double = generateRoundRobin(teams(4), { doubleRound: true });
    expect(double).toHaveLength(single.length * 2);
    expect(double.slice(single.length)).toEqual(
      single.map((f) => ({
        round: f.round + 3,
        homeTeamId: f.awayTeamId,
        awayTeamId: f.homeTeamId,
      })),
    );
  });
});
