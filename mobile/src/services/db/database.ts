import * as SQLite from 'expo-sqlite';
import { type SQLiteDatabase } from 'expo-sqlite';

export async function openDatabase(): Promise<SQLiteDatabase> {
  // Use openDatabase instead of openDatabaseSync if running async operations
  return await SQLite.openDatabaseAsync('trek.db');
}

export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration INTEGER DEFAULT 0,
      distance REAL DEFAULT 0,
      elevation_gain REAL DEFAULT 0,
      elevation_loss REAL DEFAULT 0,
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS gps_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      alt REAL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      timestamp INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_gps_points_session ON gps_points(session_id);
    CREATE INDEX IF NOT EXISTS idx_gps_points_synced ON gps_points(synced);
  `);
}
