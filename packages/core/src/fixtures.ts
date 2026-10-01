export type Fixture = { round: number; homeTeamId: string; awayTeamId: string };

export type RoundRobinOptions = {
  /** Every pair meets twice, with home and away swapped in the second half. */
  doubleRound?: boolean;
};

export function assertUniqueTeams(teamIds: readonly string[], minimum: number): void {
  if (teamIds.length < minimum) {
    throw new Error(`At least ${minimum} teams are required, got ${teamIds.length}`);
  }
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error('Team ids must be unique');
  }
}

/**
 * League fixtures using the circle method: one team stays fixed while the
 * others rotate around it. With an odd number of teams, one team sits out
 * (has a bye) each round.
 */
export function generateRoundRobin(
  teamIds: readonly string[],
  options: RoundRobinOptions = {},
): Fixture[] {
  assertUniqueTeams(teamIds, 2);

  // With an odd count the bye takes the fixed slot, which lets every team
  // play an exactly equal number of home and away games.
  let slots: (string | null)[] = teamIds.length % 2 === 0 ? [...teamIds] : [null, ...teamIds];
  const slotCount = slots.length;
  const roundCount = slotCount - 1;
  const fixtures: Fixture[] = [];

  for (let round = 0; round < roundCount; round++) {
    for (let i = 0; i < slotCount / 2; i++) {
      const a = slots[i];
      const b = slots[slotCount - 1 - i];
      if (a == null || b == null) continue;
      // Alternating which side is home keeps each team's home/away count balanced.
      const swap = i === 0 ? round % 2 === 1 : i % 2 === 1;
      fixtures.push({
        round: round + 1,
        homeTeamId: swap ? b : a,
        awayTeamId: swap ? a : b,
      });
    }
    const [fixed, ...rest] = slots;
    const last = rest.pop();
    slots = [fixed ?? null, last ?? null, ...rest];
  }

  if (!options.doubleRound) return fixtures;

  return [
    ...fixtures,
    ...fixtures.map((fixture) => ({
      round: fixture.round + roundCount,
      homeTeamId: fixture.awayTeamId,
      awayTeamId: fixture.homeTeamId,
    })),
  ];
}
