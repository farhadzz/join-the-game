import type { MatchEvent } from './events';

type EventInput = {
  [T in MatchEvent['type']]: { type: T } & Partial<
    Pick<
      Extract<MatchEvent, { type: T }>,
      'id' | 'seq' | 'deviceId' | 'period' | 'clockMs' | 'recordedAt'
    >
  > &
    (Extract<MatchEvent, { type: T }>['payload'] extends Record<string, never>
      ? { payload?: Extract<MatchEvent, { type: T }>['payload'] }
      : { payload: Extract<MatchEvent, { type: T }>['payload'] });
}[MatchEvent['type']];

/** Builds a match event log from terse inputs; `seq` and `id` default to input order. */
export function eventLog(inputs: readonly EventInput[]): MatchEvent[] {
  let period = 1;
  return inputs.map((input, index) => {
    if (input.period !== undefined) period = input.period;
    return {
      id: input.id ?? `e${index + 1}`,
      matchId: 'm1',
      seq: input.seq ?? index + 1,
      deviceId: input.deviceId ?? 'd1',
      type: input.type,
      period,
      clockMs: input.clockMs ?? null,
      recordedAt: input.recordedAt ?? '2026-01-01T10:00:00.000Z',
      recordedBy: 'u1',
      payload: input.payload ?? {},
    } as MatchEvent;
  });
}
