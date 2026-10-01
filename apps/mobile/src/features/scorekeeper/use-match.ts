import { deriveMatchState, type MatchEvent } from '@join-the-game/core';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDeviceUserId } from '@/db/device';
import { appendEvent, listEvents, type EventDraft } from '@/db/events';
import { getMatch, type LocalMatch } from '@/db/matches';

type Loaded = { match: LocalMatch; events: MatchEvent[]; userId: string };

export type UseMatchResult =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; error: Error }
  | (Loaded & {
      status: 'ready';
      state: ReturnType<typeof deriveMatchState>;
      record: (...drafts: EventDraft[]) => Promise<void>;
      recordError: Error | null;
    });

export function useMatch(matchId: string): UseMatchResult {
  const db = useSQLiteContext();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [recordError, setRecordError] = useState<Error | null>(null);
  // Writes run one at a time so each event gets the next seq, however fast the taps.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const match = await getMatch(db, matchId);
      if (!match) return null;
      const [events, userId] = await Promise.all([listEvents(db, matchId), getDeviceUserId(db)]);
      return { match, events, userId };
    })().then(
      (result) => !cancelled && setLoaded(result),
      (error: unknown) => !cancelled && setLoadError(toError(error)),
    );
    return () => {
      cancelled = true;
    };
  }, [db, matchId]);

  const record = useCallback(
    (...drafts: EventDraft[]) => {
      if (!loaded) return Promise.resolve();
      const run = queue.current.then(async () => {
        for (const draft of drafts) {
          const event = await appendEvent(db, loaded.match, draft, loaded.userId);
          setLoaded((current) => current && { ...current, events: [...current.events, event] });
        }
        setRecordError(null);
      });
      queue.current = run.catch((error: unknown) => setRecordError(toError(error)));
      return queue.current;
    },
    [db, loaded],
  );

  const state = useMemo(() => loaded && deriveMatchState(loaded.match, loaded.events), [loaded]);

  if (loadError) return { status: 'error', error: loadError };
  if (loaded === undefined || state === undefined) return { status: 'loading' };
  if (loaded === null || state === null) return { status: 'not-found' };
  return { status: 'ready', ...loaded, state, record, recordError };
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));
