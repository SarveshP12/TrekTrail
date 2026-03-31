import { GPSReading } from '../location/LocationProvider';

const EARTH_RADIUS = 6371000; // meters
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Compute 2D (horizontal-only) distance between two lat/lng points
 * using the Haversine formula. Returns meters.
 */
export function haversine2D(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute 3D Euclidean distance incorporating horizontal ground distance
 * and vertical altitude change. Returns meters.
 */
export function distance3D(
  lat1: number,
  lon1: number,
  alt1: number,
  lat2: number,
  lon2: number,
  alt2: number,
): number {
  const horiz = haversine2D(lat1, lon1, lat2, lon2);
  const vert = alt2 - alt1;
  return Math.sqrt(horiz ** 2 + vert ** 2);
}

/**
 * Incremental distance accumulator.
 * Feeds GPS readings one-at-a-time and maintains running 2D and 3D totals.
 * Applies a minimum-distance filter to reject GPS jitter.
 */
export class DistanceAccumulator {
  private totalDistance2D = 0;
  private totalDistance3D = 0;
  private lastReading: GPSReading | null = null;

  /** Minimum segment distance (meters) to accept. Segments shorter than this are ignored. */
  private readonly MIN_SEGMENT_DISTANCE = 2;
  /** Accuracy threshold (meters). Points with accuracy better than this bypass the distance filter. */
  private readonly HIGH_ACCURACY_THRESHOLD = 10;

  addReading(reading: GPSReading): void {
    if (this.lastReading) {
      const d2d = haversine2D(
        this.lastReading.latitude,
        this.lastReading.longitude,
        reading.latitude,
        reading.longitude,
      );

      const alt1 = this.lastReading.altitude ?? 0;
      const alt2 = reading.altitude ?? 0;
      const d3d = distance3D(
        this.lastReading.latitude,
        this.lastReading.longitude,
        alt1,
        reading.latitude,
        reading.longitude,
        alt2,
      );

      // Ignore GPS jitter: skip segments < MIN_SEGMENT_DISTANCE meters
      // unless the GPS accuracy is very high
      if (
        d2d >= this.MIN_SEGMENT_DISTANCE ||
        reading.accuracy < this.HIGH_ACCURACY_THRESHOLD
      ) {
        this.totalDistance2D += d2d;
        this.totalDistance3D += d3d;
      }
    }
    this.lastReading = reading;
  }

  /** Total horizontal distance in meters. */
  getDistance2D(): number {
    return this.totalDistance2D;
  }

  /** Total 3D distance (including altitude changes) in meters. */
  getDistance3D(): number {
    return this.totalDistance3D;
  }

  /** Reset accumulator state for a new session. */
  reset(): void {
    this.totalDistance2D = 0;
    this.totalDistance3D = 0;
    this.lastReading = null;
  }
}
