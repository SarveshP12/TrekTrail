import { SQLiteDatabase } from 'expo-sqlite';
import { openDatabase, initDatabase } from './database';
import { GPSReading } from '../location/LocationProvider';

export interface TrekSession {
  id: string;
  startTime: number;
  endTime?: number | null;
  duration: number;
  distance: number;
  synced: boolean;
}

export class GPSRepository {
  private db: SQLiteDatabase | null = null;

  async init() {
    this.db = await openDatabase();
    await initDatabase(this.db);
  }

  async createSession(sessionId: string, startTime: number) {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      'INSERT INTO sessions (id, start_time, end_time, duration, distance, synced) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, startTime, null, 0, 0, 0]
    );
  }

  async addPoint(sessionId: string, reading: GPSReading) {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      'INSERT INTO gps_points (session_id, lat, lon, alt, accuracy, speed, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        sessionId,
        reading.latitude,
        reading.longitude,
        reading.altitude,
        reading.accuracy,
        reading.speed,
        reading.timestamp,
        0
      ]
    );
  }

  async updateSessionStats(sessionId: string, duration: number, distance: number) {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      'UPDATE sessions SET duration = ?, distance = ? WHERE id = ?',
      [duration, distance, sessionId]
    );
  }

  async getActiveSession(): Promise<string | null> {
    if (!this.db) await this.init();
    try {
      const result = await this.db!.getFirstAsync<{ id: string }>(
        'SELECT id FROM sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'
      );
      return result?.id || null;
    } catch (e) {
      console.warn('Error fetching active session:', e);
      return null;
    }
  }

  async endSession(sessionId: string, endTime: number) {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      'UPDATE sessions SET end_time = ? WHERE id = ?',
      [endTime, sessionId]
    );
  }

  async getSessionPoints(sessionId: string): Promise<GPSReading[]> {
    if (!this.db) await this.init();
    const rows: any[] = await this.db!.getAllAsync(
      'SELECT lat as latitude, lon as longitude, alt as altitude, accuracy, speed, timestamp FROM gps_points WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );
    return rows;
  }

  async getUnsyncedPoints(limit: number = 50): Promise<any[]> {
    if (!this.db) await this.init();
    const rows = await this.db!.getAllAsync(
      'SELECT * FROM gps_points WHERE synced = 0 LIMIT ?',
      [limit]
    );
    return rows;
  }
}

export const gpsRepo = new GPSRepository();
