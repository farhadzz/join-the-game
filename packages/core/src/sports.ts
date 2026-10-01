import type { FoulKind } from './events';
import type { StandingsRules } from './standings';

export type SportId = 'football' | 'basketball';

export type SportConfig = {
  id: SportId;
  /** Points a single score event may be worth. */
  scoreValues: readonly number[];
  foulKinds: readonly FoulKind[];
  /** Whether a league match may end level; otherwise overtime is played. */
  drawsAllowed: boolean;
  standings: StandingsRules;
};

export const sports: Record<SportId, SportConfig> = {
  football: {
    id: 'football',
    scoreValues: [1],
    foulKinds: ['yellow', 'red'],
    drawsAllowed: true,
    standings: {
      points: { win: 3, draw: 1, loss: 0 },
      tieBreakers: ['scoreDifference', 'scoreFor', 'headToHead'],
    },
  },
  basketball: {
    id: 'basketball',
    scoreValues: [1, 2, 3],
    foulKinds: ['personal', 'technical'],
    drawsAllowed: false,
    // FIBA: 2 points for a win, 1 for a loss, head-to-head first.
    standings: {
      points: { win: 2, draw: 0, loss: 1 },
      tieBreakers: ['headToHead', 'scoreDifference', 'scoreFor'],
    },
  },
};
