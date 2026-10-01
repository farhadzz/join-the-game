import { sports, type MatchEvent } from '@join-the-game/core';
import { matchEventSchema, matchEventSchemaFor } from '@join-the-game/validation';
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { LocalMatch } from './matches';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What the scorekeeper decides; ids, ordering and authorship are filled in on save. */
export type EventDraft = DistributiveOmit<
  MatchEvent,
  'id' | 'matchId' | 'seq' | 'recordedAt' | 'recordedBy' | 'receivedAt'
>;

type EventRow = {
  id: string;
  match_id: string;
  seq: number;
  type: string;
  period: number;
  clock_ms: number | null;
  recorded_at: string;
  recorded_by: string;
  payload: string;
};

const toEvent = (row: EventRow): MatchEvent =>
  matchEventSchema.parse({
    id: row.id,
    matchId: row.match_id,
    seq: row.seq,
    type: row.type,
    period: row.period,
    clockMs: row.clock_ms,
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by,
    payload: JSON.parse(row.payload),
  });

export async function listEvents(db: SQLiteDatabase, matchId: string): Promise<MatchEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM match_events WHERE match_id = ? ORDER BY seq',
    matchId,
  );
  return rows.map(toEvent);
}

/**
 * Validates and stores the next event for a match. Callers must not run two
 * appends for the same match concurrently (see useMatch), so seq stays gapless.
 */
export async function appendEvent(
  db: SQLiteDatabase,
  match: LocalMatch,
  draft: EventDraft,
  recordedBy: string,
): Promise<MatchEvent> {
  const last = await db.getFirstAsync<{ seq: number | null }>(
    'SELECT MAX(seq) AS seq FROM match_events WHERE match_id = ?',
    match.id,
  );

  const event = matchEventSchemaFor({
    matchId: match.id,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    sport: sports[match.sport],
  }).parse({
    ...draft,
    id: randomUUID(),
    matchId: match.id,
    seq: (last?.seq ?? 0) + 1,
    recordedAt: new Date().toISOString(),
    recordedBy,
  });

  await db.runAsync(
    `INSERT INTO match_events (id, match_id, seq, type, period, clock_ms, recorded_at, recorded_by, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    event.matchId,
    event.seq,
    event.type,
    event.period,
    event.clockMs,
    event.recordedAt,
    event.recordedBy,
    JSON.stringify(event.payload),
  );

  return event;
}
