import type { SQLiteDatabase } from 'expo-sqlite';

/** Append-only: never edit a migration that has shipped, add a new one. */
const migrations = [
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE matches (
    id TEXT PRIMARY KEY NOT NULL,
    sport TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    home_team_name TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Doubles as the sync outbox: rows with synced_at IS NULL are pending upload.
  CREATE TABLE match_events (
    id TEXT PRIMARY KEY NOT NULL,
    match_id TEXT NOT NULL REFERENCES matches (id),
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    period INTEGER NOT NULL,
    clock_ms INTEGER,
    recorded_at TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    payload TEXT NOT NULL,
    synced_at TEXT,
    UNIQUE (match_id, seq)
  );

  CREATE INDEX match_events_pending ON match_events (synced_at) WHERE synced_at IS NULL;
  `,
  // Events record which installation wrote them. The id that was used as
  // recorded_by was already per-installation, so it becomes the device id.
  `
  UPDATE settings SET key = 'device_id' WHERE key = 'device_user_id';

  ALTER TABLE match_events ADD COLUMN device_id TEXT NOT NULL DEFAULT '';

  UPDATE match_events
  SET device_id = COALESCE((SELECT value FROM settings WHERE key = 'device_id'), recorded_by);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const [index, sql] of migrations.entries()) {
    const version = index + 1;
    if (version <= current) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
      await txn.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}
