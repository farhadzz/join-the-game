export type TieBreaker = 'headToHead' | 'scoreDifference' | 'scoreFor';

export type StandingsRules = {
  points: { win: number; draw: number; loss: number };
  /** Applied in order to separate teams level on points. */
  tieBreakers: readonly TieBreaker[];
};

export type MatchResult = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type StandingRow = {
  teamId: string;
  /** Teams still level after every tie-breaker share a rank. */
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
};

type Totals = Omit<StandingRow, 'rank'>;

function tally(
  teamIds: readonly string[],
  results: readonly MatchResult[],
  rules: StandingsRules,
): Map<string, Totals> {
  const totals = new Map<string, Totals>(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
      },
    ]),
  );

  const record = (teamId: string, scored: number, conceded: number) => {
    const row = totals.get(teamId);
    if (row === undefined) return;
    row.played += 1;
    row.scoreFor += scored;
    row.scoreAgainst += conceded;
    row.scoreDifference = row.scoreFor - row.scoreAgainst;
    if (scored > conceded) {
      row.won += 1;
      row.points += rules.points.win;
    } else if (scored < conceded) {
      row.lost += 1;
      row.points += rules.points.loss;
    } else {
      row.drawn += 1;
      row.points += rules.points.draw;
    }
  };

  for (const result of results) {
    record(result.homeTeamId, result.homeScore, result.awayScore);
    record(result.awayTeamId, result.awayScore, result.homeScore);
  }

  return totals;
}

/**
 * Splits `group` into subgroups, best first, by successive criteria.
 * Head-to-head is computed only among the teams still tied, as in most
 * competition rules.
 */
function separate(
  group: readonly Totals[],
  criteria: readonly ((group: readonly Totals[]) => (row: Totals) => number)[],
): Totals[][] {
  const [criterion, ...rest] = criteria;
  if (group.length < 2 || criterion === undefined) return [[...group]];

  const valueOf = criterion(group);
  const byValue = new Map<number, Totals[]>();
  for (const row of group) {
    const value = valueOf(row);
    byValue.set(value, [...(byValue.get(value) ?? []), row]);
  }

  return [...byValue.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, subgroup]) => separate(subgroup, rest));
}

export function computeStandings(
  teamIds: readonly string[],
  results: readonly MatchResult[],
  rules: StandingsRules,
): StandingRow[] {
  const totals = tally(teamIds, results, rules);

  const headToHead = (group: readonly Totals[]) => {
    const members = new Set(group.map((row) => row.teamId));
    const miniTable = tally(
      [...members],
      results.filter((r) => members.has(r.homeTeamId) && members.has(r.awayTeamId)),
      rules,
    );
    return (row: Totals) => miniTable.get(row.teamId)?.points ?? 0;
  };

  const criteria = [
    () => (row: Totals) => row.points,
    ...rules.tieBreakers.map((tieBreaker) =>
      tieBreaker === 'headToHead' ? headToHead : () => (row: Totals) => row[tieBreaker],
    ),
  ];

  const rows: StandingRow[] = [];
  for (const group of separate([...totals.values()], criteria)) {
    const rank = rows.length + 1;
    for (const row of group) rows.push({ ...row, rank });
  }
  return rows;
}
