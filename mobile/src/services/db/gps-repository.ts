import { SQLiteDatabase } from 'expo-sqlite';
import { openDatabase, initDatabase } from './database';
import { GPSReading } from '../location/LocationProvider';

export interface TrekSession {
  id: string;
  startTime: number;
  endTime?: number | null;
  duration: number;
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  synced: boolean;
}

export class GPSRepository {
  private db: SQLiteDatabase | null = null;

  async init() {
    this.db = await openDatabase();
    await initDatabase(this.db);
  }

  private async ensureDb(): Promise<SQLiteDatabase> {
    if (!this.db) await this.init();
    return this.db!;
  }

  async createSession(sessionId: string, startTime: number) {
    const db = await this.ensureDb();
    await db.runAsync(
      'INSERT INTO sessions (id, start_time, end_time, duration, distance, elevation_gain, elevation_loss, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionId, startTime, null, 0, 0, 0, 0, 0]
    );
  }

  async addPoint(sessionId: string, reading: GPSReading) {
    const db = await this.ensureDb();
    await db.runAsync(
      'INSERT INTO gps_points (session_id, lat, lon, alt, accuracy, speed, heading, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        sessionId,
        reading.latitude,
        reading.longitude,
        reading.altitude,
        reading.accuracy,
        reading.speed,
        reading.heading,
        reading.timestamp,
        0
      ]
    );
  }

  async updateSessionStats(
    sessionId: string,
    duration: number,
    distance: number,
    elevationGain: number = 0,
    elevationLoss: number = 0,
  ) {
    const db = await this.ensureDb();
    await db.runAsync(
      'UPDATE sessions SET duration = ?, distance = ?, elevation_gain = ?, elevation_loss = ? WHERE id = ?',
      [duration, distance, elevationGain, elevationLoss, sessionId]
    );
  }

  async getActiveSession(): Promise<string | null> {
    const db = await this.ensureDb();
    try {
      const result = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'
      );
      return result?.id || null;
    } catch (e) {
      console.warn('Error fetching active session:', e);
      return null;
    }
  }

  async endSession(sessionId: string, endTime: number) {
    const db = await this.ensureDb();
    await db.runAsync(
      'UPDATE sessions SET end_time = ? WHERE id = ?',
      [endTime, sessionId]
    );
  }

  async getSession(sessionId: string): Promise<TrekSession | null> {
    const db = await this.ensureDb();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (!row) return null;
    return {
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      distance: row.distance,
      elevationGain: row.elevation_gain ?? 0,
      elevationLoss: row.elevation_loss ?? 0,
      synced: !!row.synced,
    };
  }

  async getAllSessions(): Promise<TrekSession[]> {
    const db = await this.ensureDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM sessions ORDER BY start_time DESC'
    );
    return rows.map((row: any) => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      distance: row.distance,
      elevationGain: row.elevation_gain ?? 0,
      elevationLoss: row.elevation_loss ?? 0,
      synced: !!row.synced,
    }));
  }

  async getSessionPoints(sessionId: string): Promise<GPSReading[]> {
    const db = await this.ensureDb();
    const rows: any[] = await db.getAllAsync(
      'SELECT lat as latitude, lon as longitude, alt as altitude, accuracy, speed, heading, timestamp FROM gps_points WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );
    return rows;
  }

  async getPointCount(sessionId: string): Promise<number> {
    const db = await this.ensureDb();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM gps_points WHERE session_id = ?',
      [sessionId]
    );
    return result?.count ?? 0;
  }

  async getUnsyncedPoints(limit: number = 100): Promise<any[]> {
    const db = await this.ensureDb();
    const rows = await db.getAllAsync(
      'SELECT id, session_id, lat, lon, alt, accuracy, speed, heading, timestamp FROM gps_points WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?',
      [limit]
    );
    return rows;
  }

  /** Mark specific point IDs as synced after successful upload. */
  async markPointsSynced(pointIds: number[]): Promise<void> {
    if (pointIds.length === 0) return;
    const db = await this.ensureDb();
    const placeholders = pointIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE gps_points SET synced = 1 WHERE id IN (${placeholders})`,
      pointIds
    );
  }

  /** Mark an entire session as synced. */
  async markSessionSynced(sessionId: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync(
      'UPDATE sessions SET synced = 1 WHERE id = ?',
      [sessionId]
    );
  }

  /** Delete all points for a session (for cleanup after full sync). */
  async deleteSessionPoints(sessionId: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync(
      'DELETE FROM gps_points WHERE session_id = ?',
      [sessionId]
    );
  }
}

export const gpsRepo = new GPSRepository();
