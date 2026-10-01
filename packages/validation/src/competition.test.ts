import { describe, expect, it } from 'vitest';
import { createCompetitionSchema, createFriendlyMatchSchema } from './competition';

const valid = {
  name: 'Sunday League',
  sport: 'football',
  format: 'league',
  teams: [{ name: 'Rovers' }, { name: 'United' }],
};

const issues = (input: unknown) =>
  createCompetitionSchema
    .safeParse(input)
    .error?.issues.map((issue) => [issue.path.join('.'), issue.message]);

describe('createCompetitionSchema', () => {
  it('accepts a league and defaults to a single round', () => {
    const result = createCompetitionSchema.parse(valid);
    expect(result).toMatchObject({ format: 'league', doubleRound: false });
  });

  it('accepts a knockout competition', () => {
    expect(createCompetitionSchema.safeParse({ ...valid, format: 'knockout' }).success).toBe(true);
  });

  it('rejects doubleRound on a knockout competition', () => {
    const input = { ...valid, format: 'knockout', doubleRound: true };
    expect(createCompetitionSchema.safeParse(input).success).toBe(false);
  });

  it('trims names', () => {
    const result = createCompetitionSchema.parse({
      ...valid,
      name: '  Sunday League  ',
      teams: [{ name: ' Rovers ' }, { name: 'United' }],
    });
    expect(result.name).toBe('Sunday League');
    expect(result.teams[0]?.name).toBe('Rovers');
  });

  it('rejects a short name', () => {
    expect(issues({ ...valid, name: ' ab ' })).toEqual([
      ['name', 'Name must be at least 3 characters'],
    ]);
  });

  it('rejects an unsupported sport', () => {
    expect(issues({ ...valid, sport: 'cricket' })?.[0]?.[0]).toBe('sport');
  });

  it('requires at least two teams', () => {
    expect(issues({ ...valid, teams: [{ name: 'Rovers' }] })).toEqual([
      ['teams', 'Add at least 2 teams'],
    ]);
  });

  it('rejects duplicate team names, ignoring case and spacing', () => {
    const input = {
      ...valid,
      teams: [{ name: 'Rovers' }, { name: 'United' }, { name: ' rovers' }],
    };
    expect(issues(input)).toEqual([['teams.2.name', '"rovers" is already in this competition']]);
  });

  it('rejects blank team names', () => {
    expect(issues({ ...valid, teams: [{ name: 'Rovers' }, { name: '  ' }] })).toEqual([
      ['teams.1.name', 'Team name is required'],
    ]);
  });
});

describe('createFriendlyMatchSchema', () => {
  const friendly = { sport: 'basketball', homeTeamName: ' Rovers ', awayTeamName: 'United' };

  it('accepts two named teams and trims them', () => {
    expect(createFriendlyMatchSchema.parse(friendly)).toEqual({
      sport: 'basketball',
      homeTeamName: 'Rovers',
      awayTeamName: 'United',
    });
  });

  it('rejects the same team on both sides', () => {
    const result = createFriendlyMatchSchema.safeParse({ ...friendly, awayTeamName: 'rovers' });
    expect(result.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['awayTeamName', 'Teams must have different names'],
    ]);
  });

  it('requires both team names', () => {
    const result = createFriendlyMatchSchema.safeParse({ ...friendly, homeTeamName: ' ' });
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['homeTeamName']);
  });
});
