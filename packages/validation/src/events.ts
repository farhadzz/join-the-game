import type { MatchEvent, SportConfig } from '@join-the-game/core';
import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });

const base = {
  id: z.uuid(),
  matchId: z.uuid(),
  seq: z.int().positive(),
  period: z.int().positive(),
  clockMs: z.int().nonnegative().nullable(),
  recordedAt: timestamp,
  receivedAt: timestamp.exactOptional(),
  recordedBy: z.uuid(),
};

const event = <TType extends string, TPayload extends z.ZodType>(type: TType, payload: TPayload) =>
  z.strictObject({ ...base, type: z.literal(type), payload });

const emptyPayload = z.strictObject({});

export const matchEventSchema = z.discriminatedUnion('type', [
  event('match_started', emptyPayload),
  event('period_started', z.strictObject({ kind: z.enum(['regular', 'overtime', 'shootout']) })),
  event('period_ended', emptyPayload),
  event('clock_started', emptyPayload),
  event('clock_stopped', emptyPayload),
  event(
    'score',
    z.strictObject({
      teamId: z.uuid(),
      points: z.int().positive(),
      playerId: z.uuid().exactOptional(),
    }),
  ),
  event(
    'foul',
    z.strictObject({
      teamId: z.uuid(),
      kind: z.enum(['personal', 'technical', 'yellow', 'red']),
      playerId: z.uuid().exactOptional(),
    }),
  ),
  event('match_ended', emptyPayload),
  event('void', z.strictObject({ targetEventId: z.uuid() })),
]);

// Compile-time guard: the schema and the core type must describe the same shape.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatchesCoreType: Equals<z.infer<typeof matchEventSchema>, MatchEvent> = true;
void schemaMatchesCoreType;

export type MatchContext = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  sport: SportConfig;
};

/** Structural validation plus the rules of this match: its teams and its sport. */
export function matchEventSchemaFor(context: MatchContext) {
  const { sport } = context;
  return matchEventSchema.superRefine((event, ctx) => {
    if (event.matchId !== context.matchId) {
      ctx.addIssue({
        code: 'custom',
        path: ['matchId'],
        message: 'Event is for a different match',
      });
    }

    if (event.type !== 'score' && event.type !== 'foul') return;

    if (
      event.payload.teamId !== context.homeTeamId &&
      event.payload.teamId !== context.awayTeamId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload', 'teamId'],
        message: 'Team is not playing in this match',
      });
    }

    if (event.type === 'score' && !sport.scoreValues.includes(event.payload.points)) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload', 'points'],
        message: `A ${sport.id} score must be worth ${sport.scoreValues.join(', ')}`,
      });
    }

    if (event.type === 'foul' && !sport.foulKinds.includes(event.payload.kind)) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload', 'kind'],
        message: `${sport.id} fouls must be one of: ${sport.foulKinds.join(', ')}`,
      });
    }
  });
}
