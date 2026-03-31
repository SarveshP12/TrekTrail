import { GPSReading } from '../location/LocationProvider';

/**
 * Tracks real-time elevation gain, loss, current altitude,
 * min altitude, and max altitude from a stream of GPS readings.
 *
 * Applies a minimum elevation change threshold to avoid noise-induced
 * false gain/loss accumulation from barometric or GPS altitude jitter.
 */
export class ElevationTracker {
  private gain = 0;
  private loss = 0;
  private currentAltitude: number | null = null;
  private minAltitude: number | null = null;
  private maxAltitude: number | null = null;
  private previousAltitude: number | null = null;

  /** Minimum altitude change (meters) to count as real gain/loss. Filters sensor noise. */
  private readonly MIN_CHANGE_THRESHOLD = 1.5; // meters

  addReading(reading: GPSReading): void {
    if (reading.altitude === null) return;

    this.currentAltitude = reading.altitude;

    // Update min/max
    if (this.minAltitude === null || reading.altitude < this.minAltitude) {
      this.minAltitude = reading.altitude;
    }
    if (this.maxAltitude === null || reading.altitude > this.maxAltitude) {
      this.maxAltitude = reading.altitude;
    }

    // Compute gain/loss vs previous reading
    if (this.previousAltitude !== null) {
      const delta = reading.altitude - this.previousAltitude;
      if (Math.abs(delta) >= this.MIN_CHANGE_THRESHOLD) {
        if (delta > 0) {
          this.gain += delta;
        } else {
          this.loss += Math.abs(delta);
        }
        // Only update previousAltitude when we had a significant change
        // This avoids accumulating small noise increments
        this.previousAltitude = reading.altitude;
      }
    } else {
      this.previousAltitude = reading.altitude;
    }
  }

  /** Total elevation gained (meters). */
  getGain(): number {
    return this.gain;
  }

  /** Total elevation lost (meters). */
  getLoss(): number {
    return this.loss;
  }

  /** Current altitude in meters, or null if no altitude reading received yet. */
  getCurrentAltitude(): number | null {
    return this.currentAltitude;
  }

  /** Minimum altitude recorded during the session. */
  getMinAltitude(): number | null {
    return this.minAltitude;
  }

  /** Maximum altitude recorded during the session. */
  getMaxAltitude(): number | null {
    return this.maxAltitude;
  }

  /** Reset for a new session. */
  reset(): void {
    this.gain = 0;
    this.loss = 0;
    this.currentAltitude = null;
    this.minAltitude = null;
    this.maxAltitude = null;
    this.previousAltitude = null;
  }
}
