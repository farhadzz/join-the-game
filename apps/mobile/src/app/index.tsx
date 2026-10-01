import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { listMatchSummaries, type MatchSummary } from '@/db/matches';

const statusLabels = { scheduled: 'Not started', live: 'Live', finished: 'Finished' } as const;

export default function MatchesScreen() {
  const db = useSQLiteContext();
  const [summaries, setSummaries] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setError(null);
    listMatchSummaries(db).then(setSummaries, (e: unknown) =>
      setError(e instanceof Error ? e : new Error(String(e))),
    );
  }, [db]);

  // Reload when coming back from the scorekeeper so scores are current.
  useFocusEffect(load);

  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (summaries === null) return <LoadingState label="Loading matches" />;

  const newMatch = <Button label="New match" size="lg" onPress={() => router.push('/new-match')} />;

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      {summaries.length === 0 ? (
        <EmptyState
          title="No matches yet"
          message="Start a friendly match and keep score, even without a connection."
          action={newMatch}
        />
      ) : (
        <>
          <FlatList
            data={summaries}
            keyExtractor={(item) => item.match.id}
            contentContainerClassName="gap-3 p-4"
            renderItem={({ item: { match, state } }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${match.homeTeamName} ${state.score.home}, ${match.awayTeamName} ${state.score.away}, ${statusLabels[state.status]}`}
                onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
                className="rounded-2xl bg-zinc-100 p-4 active:opacity-70 dark:bg-zinc-900"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-medium uppercase text-zinc-500">
                    {match.sport} · {statusLabels[state.status]}
                  </Text>
                  {state.status === 'live' && <View className="h-2 w-2 rounded-full bg-red-500" />}
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="flex-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {match.homeTeamName}
                  </Text>
                  <Text className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {state.score.home} – {state.score.away}
                  </Text>
                  <Text className="flex-1 text-right text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {match.awayTeamName}
                  </Text>
                </View>
              </Pressable>
            )}
          />
          <View className="p-4 pt-0">{newMatch}</View>
        </>
      )}
    </View>
  );
}
