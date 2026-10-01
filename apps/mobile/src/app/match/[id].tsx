import {
  activeEvents,
  clockElapsedMs,
  formatClock,
  sports,
  type ClockState,
  type FoulKind,
  type PeriodKind,
} from '@join-the-game/core';
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { ErrorState, LoadingState } from '@/components/states';
import { EventLog } from '@/features/scorekeeper/event-log';
import { describeEvent, foulLabels, periodName, scoreLabel } from '@/features/scorekeeper/labels';
import { Scoreboard } from '@/features/scorekeeper/scoreboard';
import { useMatch, type UseMatchResult } from '@/features/scorekeeper/use-match';
import { useNow } from '@/features/scorekeeper/use-now';

/** Reads the wall clock, so it must run in event handlers, never during render. */
const clockNow = (clock: ClockState) => clockElapsedMs(clock, Date.now());

export default function ScorekeeperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useMatch(id);
  // The scorekeeper's screen must not dim or lock mid-match.
  useKeepAwake();

  switch (result.status) {
    case 'loading':
      return <LoadingState label="Loading match" />;
    case 'not-found':
      return <ErrorState title="Match not found" message="It may have been deleted." />;
    case 'error':
      return <ErrorState message={result.error.message} />;
    case 'ready':
      return <Scorekeeper {...result} />;
  }
}

function Scorekeeper({
  match,
  events,
  state,
  record,
  recordError,
}: Extract<UseMatchResult, { status: 'ready' }>) {
  const sport = sports[match.sport];
  const now = useNow(state.clock.running);

  const live = state.status === 'live';
  const inPlay = live && state.periodInProgress;
  const period = state.period ?? 1;
  const periodKind: PeriodKind = state.periodKind ?? 'regular';
  const usesClock = state.period !== null && periodKind !== 'shootout';
  const periodDurationMs =
    periodKind === 'overtime' ? sport.periods.overtimeDurationMs : sport.periods.durationMs;

  /** Period and game clock at the moment of the tap. Only call from event handlers. */
  const at = () => ({ period, clockMs: usesClock ? clockNow(state.clock) : null });

  const teams = [
    { id: match.homeTeamId, name: match.homeTeamName, variant: 'home' as const },
    { id: match.awayTeamId, name: match.awayTeamName, variant: 'away' as const },
  ];

  const score = (teamId: string, points: number) => {
    void impactAsync(ImpactFeedbackStyle.Heavy);
    void record({ type: 'score', ...at(), payload: { teamId, points } });
  };

  const foul = (teamId: string, kind: FoulKind) => {
    void impactAsync(ImpactFeedbackStyle.Light);
    void record({ type: 'foul', ...at(), payload: { teamId, kind } });
  };

  const startPeriod = (kind: PeriodKind) => {
    const next = state.period === null ? 1 : state.period + 1;
    void record({
      type: 'period_started',
      period: next,
      clockMs: kind === 'shootout' ? null : 0,
      payload: { kind },
    });
  };

  const lastActive = activeEvents(events).at(-1);
  const periodKinds = new Map<number, PeriodKind>(
    state.period === null ? [] : [[state.period, periodKind]],
  );

  const statusText =
    state.status === 'scheduled'
      ? 'Not started'
      : state.status === 'finished'
        ? 'Full time'
        : `${periodName(sport, period, periodKind)}${state.periodInProgress ? '' : ' · break'}`;

  const clockText = usesClock
    ? formatClock(clockElapsedMs(state.clock, now), periodDurationMs, sport.clockDirection)
    : null;

  const regulationOver = state.period !== null && state.period >= sport.periods.count;
  const shootoutPlayed = periodKind === 'shootout';

  return (
    <>
      <Stack.Screen options={{ title: `${match.homeTeamName} v ${match.awayTeamName}` }} />
      <ScrollView
        className="flex-1 bg-white dark:bg-zinc-950"
        contentContainerClassName="gap-4 p-4 pb-12"
      >
        <Scoreboard
          match={match}
          state={state}
          sport={sport}
          statusText={statusText}
          clockText={clockText}
        />

        {recordError && (
          <Text accessibilityRole="alert" className="text-center text-red-600 dark:text-red-400">
            Couldn't save the last event: {recordError.message}
          </Text>
        )}

        {state.status === 'finished' && (
          <Text className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {state.winnerTeamId === null
              ? 'Draw'
              : `${teams.find((team) => team.id === state.winnerTeamId)?.name} win`}
          </Text>
        )}

        {/* Scoring */}
        <View className="flex-row gap-3">
          {teams.map((team) => (
            <View key={team.id} className="flex-1 gap-3">
              {sport.scoreValues.map((points) => (
                <Button
                  key={points}
                  label={sport.scoreValues.length === 1 ? scoreLabel(sport, points) : `+${points}`}
                  accessibilityLabel={`${scoreLabel(sport, points)} for ${team.name}`}
                  variant={team.variant}
                  size="xl"
                  disabled={!inPlay}
                  onPress={() => score(team.id, points)}
                />
              ))}
              <View className="flex-row gap-2">
                {sport.foulKinds.map((kind) => (
                  <Button
                    key={kind}
                    label={foulLabels[kind]}
                    accessibilityLabel={`${foulLabels[kind]} for ${team.name}`}
                    variant="secondary"
                    className="flex-1 px-2"
                    disabled={!inPlay}
                    onPress={() => foul(team.id, kind)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Match flow */}
        <View className="gap-3">
          {state.status === 'scheduled' && (
            <Button
              label="Start match"
              size="lg"
              onPress={() =>
                void record(
                  { type: 'match_started', period: 1, clockMs: null, payload: {} },
                  { type: 'period_started', period: 1, clockMs: 0, payload: { kind: 'regular' } },
                )
              }
            />
          )}

          {inPlay && (
            <View className="flex-row gap-3">
              {usesClock && (
                <Button
                  label={state.clock.running ? 'Pause clock' : 'Start clock'}
                  size="lg"
                  className="flex-1"
                  onPress={() =>
                    void record({
                      type: state.clock.running ? 'clock_stopped' : 'clock_started',
                      ...at(),
                      payload: {},
                    })
                  }
                />
              )}
              <Button
                label={`End ${periodName(sport, period, periodKind)}`}
                variant="secondary"
                size="lg"
                className="flex-1"
                onPress={() => void record({ type: 'period_ended', ...at(), payload: {} })}
              />
            </View>
          )}

          {live && !state.periodInProgress && (
            <View className="gap-3">
              {!regulationOver && (
                <Button
                  label={`Start ${periodName(sport, period + 1, 'regular')}`}
                  size="lg"
                  onPress={() => startPeriod('regular')}
                />
              )}
              {regulationOver && !shootoutPlayed && (
                <View className="flex-row gap-3">
                  <Button
                    label="Overtime"
                    size="lg"
                    className="flex-1"
                    onPress={() => startPeriod('overtime')}
                  />
                  {sport.shootouts && (
                    <Button
                      label="Shootout"
                      size="lg"
                      className="flex-1"
                      onPress={() => startPeriod('shootout')}
                    />
                  )}
                </View>
              )}
              <Button
                label="End match"
                variant="danger"
                size="lg"
                onPress={() => void record({ type: 'match_ended', ...at(), payload: {} })}
              />
            </View>
          )}

          {lastActive && (
            <Button
              label={`Undo: ${describeEvent(lastActive, match, sport, periodKinds)}`}
              variant="secondary"
              onPress={() =>
                void record({ type: 'void', ...at(), payload: { targetEventId: lastActive.id } })
              }
            />
          )}
        </View>

        <EventLog match={match} events={events} sport={sport} />
      </ScrollView>
    </>
  );
}
