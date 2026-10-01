import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

const KEY = 'device_user_id';

/**
 * Stable id used as `recordedBy` until sign-in exists; it will be replaced
 * by the Supabase user id.
 */
export async function getDeviceUserId(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    KEY,
  );
  if (row) return row.value;

  const id = randomUUID();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', KEY, id);
  return id;
}
