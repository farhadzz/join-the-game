import type { MatchState, SportConfig } from '@join-the-game/core';
import { Text, View } from 'react-native';
import type { LocalMatch } from '@/db/matches';

type Props = {
  match: LocalMatch;
  state: MatchState;
  sport: SportConfig;
  statusText: string;
  clockText: string | null;
};

export function Scoreboard({ match, state, sport, statusText, clockText }: Props) {
  const hasShootout = state.shootout.home > 0 || state.shootout.away > 0;
  const foulsLabel = sport.id === 'football' ? 'Cards' : 'Fouls';

  const side = (name: string, score: number, shootout: number, fouls: number, color: string) => (
    <View className="flex-1 items-center gap-1">
      <Text numberOfLines={2} className={`text-center text-lg font-semibold ${color}`}>
        {name}
      </Text>
      <Text className="text-7xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
        {score}
      </Text>
      {hasShootout && (
        <Text className="text-base font-semibold tabular-nums text-zinc-500">({shootout})</Text>
      )}
      <Text className="text-sm text-zinc-500">
        {foulsLabel}: {fouls}
      </Text>
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={`${statusText}${clockText ? `, ${clockText}` : ''}. ${match.homeTeamName} ${state.score.home}, ${match.awayTeamName} ${state.score.away}`}
      className="gap-3 rounded-3xl bg-zinc-100 p-4 dark:bg-zinc-900"
    >
      <View className="items-center">
        <Text className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          {statusText}
        </Text>
        {clockText && (
          <Text className="text-4xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {clockText}
          </Text>
        )}
      </View>
      <View className="flex-row items-start">
        {side(
          match.homeTeamName,
          state.score.home,
          state.shootout.home,
          state.fouls.home,
          'text-home dark:text-home-dark',
        )}
        {side(
          match.awayTeamName,
          state.score.away,
          state.shootout.away,
          state.fouls.away,
          'text-away dark:text-away-dark',
        )}
      </View>
    </View>
  );
}
