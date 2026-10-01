import {
  activeEvents,
  formatClock,
  type MatchEvent,
  type PeriodKind,
  type SportConfig,
} from '@join-the-game/core';
import { Text, View } from 'react-native';
import type { LocalMatch } from '@/db/matches';
import { describeEvent } from './labels';

type Props = { match: LocalMatch; events: readonly MatchEvent[]; sport: SportConfig };

export function EventLog({ match, events, sport }: Props) {
  const active = activeEvents(events);
  const activeIds = new Set(active.map((event) => event.id));
  const periodKinds = new Map<number, PeriodKind>();
  for (const event of active) {
    if (event.type === 'period_started') periodKinds.set(event.period, event.payload.kind);
  }

  const entries = events.filter((event) => event.type !== 'void').reverse();

  return (
    <View className="gap-2">
      <Text
        accessibilityRole="header"
        className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Event log
      </Text>
      {entries.length === 0 ? (
        <Text className="text-zinc-500">Events you record will appear here.</Text>
      ) : (
        entries.map((event) => {
          const undone = !activeIds.has(event.id);
          const description = describeEvent(event, match, sport, periodKinds);
          return (
            <View
              key={event.id}
              accessible
              accessibilityLabel={`${description}${undone ? ', undone' : ''}`}
              className="flex-row gap-3 border-b border-zinc-200 py-2 dark:border-zinc-800"
            >
              <Text className="w-14 tabular-nums text-zinc-500">
                {event.clockMs === null
                  ? ''
                  : formatClock(
                      event.clockMs,
                      periodKinds.get(event.period) === 'overtime'
                        ? sport.periods.overtimeDurationMs
                        : sport.periods.durationMs,
                      sport.clockDirection,
                    )}
              </Text>
              <Text
                className={`flex-1 ${undone ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-100'}`}
              >
                {description}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}
