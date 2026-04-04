import { GPSReading } from '../location/LocationProvider';
import { DistanceAccumulator } from './DistanceAccumulator';
import { ElevationTracker } from './ElevationTracker';
import { SpeedCalculator } from './SpeedCalculator';
import { KalmanFilter, SmoothedGPSReading } from '../ai/KalmanFilter';
import { ActivityClassifier } from '../ai/ActivityClassifier';
import { ActivityLabel } from '../ai/FeatureExtractor';

/**
 * Aggregates all real-time trek statistics into a single engine.
 * Consumes GPS readings and produces a unified stats snapshot.
 */
export interface TrekStatsSnapshot {
  distance2D: number; // meters
  distance3D: number; // meters
  speed: number; // m/s instantaneous
  avgSpeed: number; // m/s moving average
  altitude: number | null; // meters
  elevationGain: number; // meters
  elevationLoss: number; // meters
  minAltitude: number | null; // meters
  maxAltitude: number | null; // meters
  durationMs: number; // elapsed time in ms
  pointCount: number; // total GPS points recorded
  pace: number | null; // min/km, null if speed is 0
  // GPS quality metrics (populated when Kalman filter is active)
  gpsFilteredCount: number; // readings that passed through the filter
  gpsRejectedCount: number; // readings rejected (poor accuracy)
  gpsEstimatedAccuracy: number | null; // filter's current accuracy estimate (m)
  // Activity classification
  currentActivity: ActivityLabel;
}

export class TrekStatsEngine {
  private distanceAccumulator: DistanceAccumulator;
  private elevationTracker: ElevationTracker;
  private speedCalculator: SpeedCalculator;
  private kalmanFilter: KalmanFilter | null;
  private activityClassifier: ActivityClassifier | null;
  private startTime: number = 0;
  private pointCount: number = 0;
  private filteredCount: number = 0;
  private rejectedCount: number = 0;
  private lastSmoothed: SmoothedGPSReading | null = null;
  private pausedDurationMs: number = 0;
  private pauseStartTime: number | null = null;

  constructor(speedWindowMs: number = 30000, kalmanFilter?: KalmanFilter, activityClassifier?: ActivityClassifier) {
    this.distanceAccumulator = new DistanceAccumulator();
    this.elevationTracker = new ElevationTracker();
    this.speedCalculator = new SpeedCalculator(speedWindowMs);
    this.kalmanFilter = kalmanFilter ?? null;
    this.activityClassifier = activityClassifier ?? null;
  }

  /** Start the trek timer. Call once at the beginning of a trek. */
  start(): void {
    this.startTime = Date.now();
  }

  /** Pause the trek timer. Duration while paused is excluded from stats. */
  pause(): void {
    if (this.pauseStartTime === null) {
      this.pauseStartTime = Date.now();
    }
  }

  /** Resume the trek timer after a pause. */
  resume(): void {
    if (this.pauseStartTime !== null) {
      this.pausedDurationMs += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }
  }

  /** Feed a new GPS reading into all sub-engines.
   *  If a Kalman filter is attached, the reading is smoothed first.
   *  Returns the (possibly smoothed) reading that was actually used,
   *  or null if the filter rejected the reading. */
  addReading(reading: GPSReading): GPSReading | null {
    this.pointCount++;

    let processed: GPSReading = reading;

    if (this.kalmanFilter) {
      const smoothed = this.kalmanFilter.filter(reading);
      if (!smoothed) {
        // Filter rejected this reading (poor accuracy)
        this.rejectedCount++;
        return null;
      }
      this.filteredCount++;
      this.lastSmoothed = smoothed;
      processed = smoothed;
    }

    this.distanceAccumulator.addReading(processed);
    this.elevationTracker.addReading(processed);
    this.speedCalculator.addReading(processed);
    
    if (this.activityClassifier) {
      // Fire-and-forget async classification inference
      this.activityClassifier.classify(processed).catch(err => {
        console.warn('[TrekStatsEngine] Error in activity classification', err);
      });
    }

    return processed;
  }

  /** Get the current stats snapshot. */
  getStats(): TrekStatsSnapshot {
    const speed = this.speedCalculator.getInstantaneousSpeed();
    const avgSpeed = this.speedCalculator.getAverageSpeed();
    const durationMs = this.getActiveDuration();

    // Pace in min/km (null if not moving)
    let pace: number | null = null;
    if (avgSpeed > 0.1) {
      // m/s to min/km: (1000 / speed) / 60
      pace = 1000 / avgSpeed / 60;
    }

    return {
      distance2D: this.distanceAccumulator.getDistance2D(),
      distance3D: this.distanceAccumulator.getDistance3D(),
      speed,
      avgSpeed,
      altitude: this.elevationTracker.getCurrentAltitude(),
      elevationGain: this.elevationTracker.getGain(),
      elevationLoss: this.elevationTracker.getLoss(),
      minAltitude: this.elevationTracker.getMinAltitude(),
      maxAltitude: this.elevationTracker.getMaxAltitude(),
      durationMs,
      pointCount: this.pointCount,
      pace,
      gpsFilteredCount: this.filteredCount,
      gpsRejectedCount: this.rejectedCount,
      gpsEstimatedAccuracy: this.lastSmoothed?.estimatedAccuracy ?? null,
      currentActivity: this.activityClassifier?.getCurrentActivity() ?? 'IDLE',
    };
  }

  /** Get active duration excluding paused time. */
  private getActiveDuration(): number {
    if (this.startTime === 0) return 0;
    const elapsed = Date.now() - this.startTime;
    const currentPause =
      this.pauseStartTime !== null ? Date.now() - this.pauseStartTime : 0;
    return elapsed - this.pausedDurationMs - currentPause;
  }

  /** Reset all stats for a new session. */
  reset(): void {
    this.distanceAccumulator.reset();
    this.elevationTracker.reset();
    this.speedCalculator.reset();
    this.kalmanFilter?.reset();
    this.startTime = 0;
    this.pointCount = 0;
    this.filteredCount = 0;
    this.rejectedCount = 0;
    this.lastSmoothed = null;
    this.pausedDurationMs = 0;
    this.pauseStartTime = null;
  }
}
