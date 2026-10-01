export type PeriodKind = 'regular' | 'overtime' | 'shootout';

export type FoulKind = 'personal' | 'technical' | 'yellow' | 'red';

type EmptyPayload = Record<string, never>;

type EventBase<TType extends string, TPayload> = {
  /** Client-generated UUID; makes re-sending an event idempotent. */
  id: string;
  matchId: string;
  /** Per-match counter. The only source of truth for ordering (device clocks drift). */
  seq: number;
  /** Installation that recorded the event; breaks `seq` ties once several devices can write. */
  deviceId: string;
  type: TType;
  period: number;
  /** Elapsed game clock within the period, in ms. */
  clockMs: number | null;
  /** Device time, informational only. */
  recordedAt: string;
  /** Set by the server on sync. */
  receivedAt?: string;
  recordedBy: string;
  payload: TPayload;
};

export type MatchStartedEvent = EventBase<'match_started', EmptyPayload>;
export type PeriodStartedEvent = EventBase<'period_started', { kind: PeriodKind }>;
export type PeriodEndedEvent = EventBase<'period_ended', EmptyPayload>;
export type ClockStartedEvent = EventBase<'clock_started', EmptyPayload>;
export type ClockStoppedEvent = EventBase<'clock_stopped', EmptyPayload>;
export type ScoreEvent = EventBase<'score', { teamId: string; points: number; playerId?: string }>;
export type FoulEvent = EventBase<'foul', { teamId: string; kind: FoulKind; playerId?: string }>;
export type MatchEndedEvent = EventBase<'match_ended', EmptyPayload>;
/** Undo. Events are never deleted; voiding a void restores its target. */
export type VoidEvent = EventBase<'void', { targetEventId: string }>;

export type MatchEvent =
  | MatchStartedEvent
  | PeriodStartedEvent
  | PeriodEndedEvent
  | ClockStartedEvent
  | ClockStoppedEvent
  | ScoreEvent
  | FoulEvent
  | MatchEndedEvent
  | VoidEvent;

export type EventType = MatchEvent['type'];

/**
 * Returns the events that are in effect, ordered by `seq`: duplicates removed,
 * voided events and the void events themselves dropped.
 */
export function activeEvents(events: readonly MatchEvent[]): MatchEvent[] {
  const unique = new Map<string, MatchEvent>();
  for (const event of events) unique.set(event.id, event);
  const ordered = [...unique.values()].sort(
    (a, b) => a.seq - b.seq || (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0),
  );

  // A void always targets an earlier event, so walking backwards resolves
  // chains (void of a void) in a single pass.
  const voided = new Set<string>();
  for (const event of [...ordered].reverse()) {
    if (event.type === 'void' && !voided.has(event.id)) {
      voided.add(event.payload.targetEventId);
    }
  }

  return ordered.filter((event) => event.type !== 'void' && !voided.has(event.id));
}
