import type { FoulKind, MatchEvent, PeriodKind, SportConfig } from '@join-the-game/core';
import type { LocalMatch } from '@/db/matches';

export function periodName(sport: SportConfig, period: number, kind: PeriodKind): string {
  if (kind === 'shootout') return 'Shootout';
  if (kind === 'overtime') {
    const number = period - sport.periods.count;
    return number === 1 ? 'Overtime' : `Overtime ${number}`;
  }
  return `${sport.periods.label} ${period}`;
}

export const foulLabels: Record<FoulKind, string> = {
  personal: 'Foul',
  technical: 'Technical',
  yellow: 'Yellow card',
  red: 'Red card',
};

export function scoreLabel(sport: SportConfig, points: number): string {
  if (sport.id === 'football') return 'Goal';
  return points === 1 ? 'Free throw' : `${points} pointer`;
}

export function describeEvent(
  event: MatchEvent,
  match: LocalMatch,
  sport: SportConfig,
  periodKinds: ReadonlyMap<number, PeriodKind>,
): string {
  const team = (teamId: string) =>
    teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName;
  const period = periodName(sport, event.period, periodKinds.get(event.period) ?? 'regular');

  switch (event.type) {
    case 'match_started':
      return 'Match started';
    case 'period_started':
      return `${period} started`;
    case 'period_ended':
      return `${period} ended`;
    case 'clock_started':
      return 'Clock started';
    case 'clock_stopped':
      return 'Clock stopped';
    case 'score':
      return `${scoreLabel(sport, event.payload.points)} · ${team(event.payload.teamId)}`;
    case 'foul':
      return `${foulLabels[event.payload.kind]} · ${team(event.payload.teamId)}`;
    case 'match_ended':
      return 'Match ended';
    case 'void':
      return 'Undo';
  }
}
