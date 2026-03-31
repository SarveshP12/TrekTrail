import { GPSReading } from '../location/LocationProvider';
import { haversine2D } from './DistanceAccumulator';

/**
 * Computes instantaneous speed and a configurable moving average speed
 * from a stream of GPS readings.
 *
 * The moving average window defaults to 30 seconds, which provides a
 * smooth speed metric even over rough terrain with GPS jitter.
 */
export class SpeedCalculator {
  private windowMs: number;
  private readings: GPSReading[] = [];

  constructor(windowMs: number = 30000) {
    this.windowMs = windowMs;
  }

  addReading(reading: GPSReading): void {
    this.readings.push(reading);
    // Evict readings outside the moving average window
    const cutoff = reading.timestamp - this.windowMs;
    while (this.readings.length > 1 && this.readings[0].timestamp < cutoff) {
      this.readings.shift();
    }
  }

  /** Instantaneous speed in m/s from the last two readings. */
  getInstantaneousSpeed(): number {
    if (this.readings.length < 2) return 0;
    const a = this.readings[this.readings.length - 2];
    const b = this.readings[this.readings.length - 1];
    const dist = haversine2D(
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude,
    );
    const dt = (b.timestamp - a.timestamp) / 1000;
    return dt > 0 ? dist / dt : 0;
  }

  /** Moving average speed in m/s over the configured window. */
  getAverageSpeed(): number {
    if (this.readings.length < 2) return 0;
    let totalDist = 0;
    for (let i = 1; i < this.readings.length; i++) {
      totalDist += haversine2D(
        this.readings[i - 1].latitude,
        this.readings[i - 1].longitude,
        this.readings[i].latitude,
        this.readings[i].longitude,
      );
    }
    const totalTime =
      (this.readings[this.readings.length - 1].timestamp -
        this.readings[0].timestamp) /
      1000;
    return totalTime > 0 ? totalDist / totalTime : 0;
  }

  /** Get the current window size in milliseconds. */
  getWindowMs(): number {
    return this.windowMs;
  }

  /** Number of readings currently in the window. */
  getReadingCount(): number {
    return this.readings.length;
  }

  /** Reset for a new session. */
  reset(): void {
    this.readings = [];
  }
}
