import { deriveMatchState, type MatchState, type SportId } from '@join-the-game/core';
import type { CreateFriendlyMatch } from '@join-the-game/validation';
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { listEvents } from './events';

export type LocalMatch = {
  id: string;
  sport: SportId;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  createdAt: string;
};

type MatchRow = {
  id: string;
  sport: SportId;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  created_at: string;
};

const toMatch = (row: MatchRow): LocalMatch => ({
  id: row.id,
  sport: row.sport,
  homeTeamId: row.home_team_id,
  homeTeamName: row.home_team_name,
  awayTeamId: row.away_team_id,
  awayTeamName: row.away_team_name,
  createdAt: row.created_at,
});

export async function createFriendlyMatch(
  db: SQLiteDatabase,
  input: CreateFriendlyMatch,
): Promise<string> {
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO matches (id, sport, home_team_id, home_team_name, away_team_id, away_team_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sport,
    randomUUID(),
    input.homeTeamName,
    randomUUID(),
    input.awayTeamName,
    new Date().toISOString(),
  );
  return id;
}

export async function getMatch(db: SQLiteDatabase, id: string): Promise<LocalMatch | null> {
  const row = await db.getFirstAsync<MatchRow>('SELECT * FROM matches WHERE id = ?', id);
  return row ? toMatch(row) : null;
}

export type MatchSummary = { match: LocalMatch; state: MatchState };

export async function listMatchSummaries(db: SQLiteDatabase): Promise<MatchSummary[]> {
  const rows = await db.getAllAsync<MatchRow>('SELECT * FROM matches ORDER BY created_at DESC');
  return Promise.all(
    rows.map(async (row) => {
      const match = toMatch(row);
      return { match, state: deriveMatchState(match, await listEvents(db, match.id)) };
    }),
  );
}
