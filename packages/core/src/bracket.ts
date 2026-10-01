import { assertUniqueTeams } from './fixtures';

export type BracketSlot =
  { kind: 'team'; teamId: string } | { kind: 'bye' } | { kind: 'winner'; matchId: string };

export type BracketMatch = {
  id: string;
  round: number;
  /** 1-based position within the round, top to bottom. */
  position: number;
  home: BracketSlot;
  away: BracketSlot;
};

export type Bracket = { roundCount: number; matches: BracketMatch[] };

const matchId = (round: number, position: number) => `r${round}m${position}`;

/**
 * Seed numbers in bracket order, so that 1 and 2 can only meet in the final:
 * for 8 slots, [1, 8, 4, 5, 2, 7, 3, 6].
 */
export function seedOrder(slotCount: number): number[] {
  let order = [1];
  while (order.length < slotCount) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order;
}

/**
 * Single-elimination bracket. Teams are listed by seed (strongest first).
 * When the count is not a power of two, the top seeds get first-round byes.
 */
export function generateKnockoutBracket(seededTeamIds: readonly string[]): Bracket {
  assertUniqueTeams(seededTeamIds, 2);

  const roundCount = Math.ceil(Math.log2(seededTeamIds.length));
  const order = seedOrder(2 ** roundCount);
  const slotFor = (seed: number): BracketSlot => {
    const teamId = seededTeamIds[seed - 1];
    return teamId === undefined ? { kind: 'bye' } : { kind: 'team', teamId };
  };

  const matches: BracketMatch[] = [];
  for (let position = 1; position <= order.length / 2; position++) {
    matches.push({
      id: matchId(1, position),
      round: 1,
      position,
      home: slotFor(order[2 * position - 2] ?? 0),
      away: slotFor(order[2 * position - 1] ?? 0),
    });
  }

  for (let round = 2; round <= roundCount; round++) {
    const matchCount = 2 ** (roundCount - round);
    for (let position = 1; position <= matchCount; position++) {
      matches.push({
        id: matchId(round, position),
        round,
        position,
        home: { kind: 'winner', matchId: matchId(round - 1, 2 * position - 1) },
        away: { kind: 'winner', matchId: matchId(round - 1, 2 * position) },
      });
    }
  }

  return { roundCount, matches };
}

export type ResolvedMatch = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  /** One side is a bye; the other team advances without playing. */
  isBye: boolean;
};

/**
 * Fills in who plays in each match, given the winners decided so far.
 * Byes advance automatically. Winners that aren't one of the two teams are ignored.
 */
export function resolveBracket(
  bracket: Bracket,
  winners: ReadonlyMap<string, string>,
): Map<string, ResolvedMatch> {
  const resolved = new Map<string, ResolvedMatch>();

  const teamIn = (slot: BracketSlot): string | null => {
    if (slot.kind === 'team') return slot.teamId;
    if (slot.kind === 'winner') return resolved.get(slot.matchId)?.winnerTeamId ?? null;
    return null;
  };

  // Matches are ordered by round, so feeder matches are always resolved first.
  for (const match of bracket.matches) {
    const homeTeamId = teamIn(match.home);
    const awayTeamId = teamIn(match.away);
    const isBye = match.home.kind === 'bye' || match.away.kind === 'bye';

    let winnerTeamId: string | null = null;
    if (isBye) {
      winnerTeamId = homeTeamId ?? awayTeamId;
    } else {
      const winner = winners.get(match.id);
      if (winner !== undefined && (winner === homeTeamId || winner === awayTeamId)) {
        winnerTeamId = winner;
      }
    }

    resolved.set(match.id, { homeTeamId, awayTeamId, winnerTeamId, isBye });
  }

  return resolved;
}

/** The final's winner, once decided. */
export function bracketChampion(
  bracket: Bracket,
  resolved: ReadonlyMap<string, ResolvedMatch>,
): string | null {
  return resolved.get(matchId(bracket.roundCount, 1))?.winnerTeamId ?? null;
}
