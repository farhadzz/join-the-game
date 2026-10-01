import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

const KEY = 'device_id';

/**
 * Stable id for this installation, stored on every event it records.
 * Until sign-in exists it also stands in for the user as `recordedBy`.
 */
export async function getDeviceId(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    KEY,
  );
  if (row) return row.value;

  const id = randomUUID();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', KEY, id);
  return id;
}
