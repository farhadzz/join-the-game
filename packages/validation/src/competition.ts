import type { SportId } from '@join-the-game/core';
import { z } from 'zod';

export const sportIdSchema = z.enum(['football', 'basketball'] satisfies SportId[]);

const teamsSchema = z
  .array(z.strictObject({ name: z.string().trim().min(1, 'Team name is required').max(50) }))
  .min(2, 'Add at least 2 teams')
  .max(64, 'A competition can have at most 64 teams')
  .superRefine((teams, ctx) => {
    const seen = new Set<string>();
    teams.forEach((team, index) => {
      const key = team.name.toLocaleLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'name'],
          message: `"${team.name}" is already in this competition`,
        });
      }
      seen.add(key);
    });
  });

const common = {
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(80),
  sport: sportIdSchema,
  teams: teamsSchema,
};

export const createCompetitionSchema = z.discriminatedUnion('format', [
  z.strictObject({
    ...common,
    format: z.literal('league'),
    /** Every pair meets home and away. */
    doubleRound: z.boolean().default(false),
  }),
  z.strictObject({ ...common, format: z.literal('knockout') }),
]);

export type CreateCompetitionInput = z.input<typeof createCompetitionSchema>;
export type CreateCompetition = z.output<typeof createCompetitionSchema>;
