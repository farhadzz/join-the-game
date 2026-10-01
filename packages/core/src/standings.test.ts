import { describe, expect, it } from 'vitest';
import { sports } from './sports';
import { computeStandings, type MatchResult, type StandingsRules } from './standings';

const result = (home: string, homeScore: number, awayScore: number, away: string): MatchResult => ({
  homeTeamId: home,
  awayTeamId: away,
  homeScore,
  awayScore,
});

const football = sports.football.standings;
const order = (rows: { teamId: string }[]) => rows.map((row) => row.teamId);

// d tops the table; a and b finish level on 3 points.
// a has the better score difference, but b won their head-to-head.
const levelOnPoints = [
  result('a', 5, 0, 'c'),
  result('b', 1, 0, 'a'),
  result('d', 1, 0, 'b'),
  result('c', 0, 0, 'd'),
];

describe('computeStandings', () => {
  it('lists every team with zeroes before any match', () => {
    const rows = computeStandings(['a', 'b'], [], football);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ played: 0, points: 0, rank: 1 });
    expect(rows[1]).toMatchObject({ played: 0, points: 0, rank: 1 });
  });

  it('records wins, draws, losses and scores', () => {
    const rows = computeStandings(
      ['a', 'b', 'c'],
      [result('a', 2, 0, 'b'), result('b', 1, 1, 'c'), result('c', 0, 3, 'a')],
      football,
    );
    expect(rows[0]).toEqual({
      teamId: 'a',
      rank: 1,
      played: 2,
      won: 2,
      drawn: 0,
      lost: 0,
      scoreFor: 5,
      scoreAgainst: 0,
      scoreDifference: 5,
      points: 6,
    });
    expect(order(rows)).toEqual(['a', 'b', 'c']);
  });

  it('uses the sport points system', () => {
    const [winner, loser] = computeStandings(
      ['a', 'b'],
      [result('a', 80, 70, 'b')],
      sports.basketball.standings,
    );
    expect(winner?.points).toBe(2);
    expect(loser?.points).toBe(1);
  });

  it('breaks a points tie by score difference, then score for', () => {
    const rows = computeStandings(
      ['a', 'b', 'c', 'd'],
      [result('a', 1, 0, 'd'), result('b', 3, 2, 'd'), result('c', 4, 0, 'd')],
      football,
    );
    expect(order(rows)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('breaks a tie by head-to-head among only the tied teams', () => {
    const rules: StandingsRules = { ...football, tieBreakers: ['headToHead'] };
    const rows = computeStandings(['a', 'b', 'c', 'd'], levelOnPoints, rules);
    expect(order(rows)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('applies tie-breakers in the configured order', () => {
    const byDifference = computeStandings(['a', 'b', 'c', 'd'], levelOnPoints, {
      ...football,
      tieBreakers: ['scoreDifference', 'headToHead'],
    });
    const byHeadToHead = computeStandings(['a', 'b', 'c', 'd'], levelOnPoints, {
      ...football,
      tieBreakers: ['headToHead', 'scoreDifference'],
    });
    expect(order(byDifference)).toEqual(['d', 'a', 'b', 'c']);
    expect(order(byHeadToHead)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('shares a rank when teams are level on every criterion', () => {
    const rows = computeStandings(
      ['a', 'b', 'c'],
      [result('a', 1, 1, 'b'), result('c', 0, 2, 'a'), result('c', 0, 2, 'b')],
      football,
    );
    expect(rows.map((row) => [row.teamId, row.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });

  it('ignores results for unknown teams', () => {
    const rows = computeStandings(['a'], [result('a', 1, 0, 'x')], football);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.points).toBe(3);
  });
});
