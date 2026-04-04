/**
 * FeatureExtractor.ts — On-Device Sliding-Window Feature Extraction
 *
 * Mirrors the Python feature_extractor.py logic exactly so that
 * on-device inference produces the same features as training.
 *
 * Extracts 20 statistical features from a window of GPS readings:
 *   Speed (5), Distance (3), Altitude (5), Heading (3), Acceleration (2),
 *   Temporal (1), Step frequency proxy (1)
 */

import { GPSReading } from '../location/LocationProvider';

// ─── Feature Names (must match Python FEATURE_NAMES order exactly) ────────────

export const FEATURE_NAMES = [
  'speed_mean',
  'speed_std',
  'speed_max',
  'speed_min',
  'speed_range',
  'total_distance',
  'displacement',
  'sinuosity',
  'altitude_mean',
  'altitude_std',
  'altitude_delta',
  'altitude_gain',
  'altitude_loss',
  'heading_mean_sin',
  'heading_mean_cos',
  'heading_std',
  'acceleration_mean',
  'acceleration_std',
  'window_duration_s',
  'speed_zero_crossings',
] as const;

export const NUM_FEATURES = FEATURE_NAMES.length; // 20

// ─── Activity Labels ─────────────────────────────────────────────────────────

export const ACTIVITY_LABELS = ['IDLE', 'WALKING', 'TREKKING', 'RUNNING', 'CYCLING'] as const;
export type ActivityLabel = (typeof ACTIVITY_LABELS)[number];
export const NUM_CLASSES = ACTIVITY_LABELS.length;

// ─── Scaler (loaded from training output) ─────────────────────────────────────

export interface ScalerParams {
  mean: number[];
  scale: number[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rlat1 = lat1 * DEG_TO_RAD;
  const rlat2 = lat2 * DEG_TO_RAD;
  const dlat = (lat2 - lat1) * DEG_TO_RAD;
  const dlon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dlon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function std(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / arr.length); // population std (matches numpy default)
}

// ─── Feature Extractor ───────────────────────────────────────────────────────

export interface FeatureExtractionConfig {
  /** Number of readings per sliding window */
  windowSize: number;
  /** How many readings to slide by */
  stepSize: number;
  /** Optional StandardScaler params from training */
  scaler?: ScalerParams;
}

const DEFAULT_CONFIG: FeatureExtractionConfig = {
  windowSize: 5,
  stepSize: 1,
};

/**
 * On-device feature extractor for the activity classifier.
 *
 * Maintains a rolling buffer of GPS readings and produces
 * feature vectors when enough readings have accumulated.
 *
 * Usage:
 * ```ts
 * const extractor = new FeatureExtractor({ windowSize: 5 });
 * // In the GPS callback:
 * const features = extractor.addReading(gpsReading);
 * if (features) {
 *   // Pass features to ActivityClassifier for inference
 * }
 * ```
 */
export class FeatureExtractor {
  private config: FeatureExtractionConfig;
  private buffer: GPSReading[] = [];
  private stepCounter: number = 0;

  constructor(config: Partial<FeatureExtractionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a GPS reading to the buffer.
   * Returns a feature vector if a full window is available and the step
   * condition is met, otherwise returns null.
   */
  addReading(reading: GPSReading): Float32Array | null {
    this.buffer.push(reading);

    // Evict oldest readings beyond the window
    while (this.buffer.length > this.config.windowSize) {
      this.buffer.shift();
    }

    // Not enough readings yet
    if (this.buffer.length < this.config.windowSize) {
      return null;
    }

    // Honor step size
    this.stepCounter++;
    if (this.stepCounter < this.config.stepSize) {
      return null;
    }
    this.stepCounter = 0;

    // Extract features from the current window
    const features = this.extractFeatures(this.buffer);

    // Apply standard scaling if scaler is provided
    if (this.config.scaler) {
      return this.applyScaler(features, this.config.scaler);
    }

    return features;
  }

  /**
   * Extract features from a window of GPS readings.
   * Returns a Float32Array of shape [NUM_FEATURES].
   */
  extractFeatures(window: GPSReading[]): Float32Array {
    const n = window.length;
    const features = new Float32Array(NUM_FEATURES);

    // ── Speed features ──
    const speeds: number[] = [];
    for (let i = 0; i < n; i++) {
      speeds.push(window[i].speed ?? 0);
    }
    const speedMean = mean(speeds);
    const speedStd = std(speeds);
    const speedMax = Math.max(...speeds);
    const speedMin = Math.min(...speeds);

    features[0] = speedMean;
    features[1] = speedStd;
    features[2] = speedMax;
    features[3] = speedMin;
    features[4] = speedMax - speedMin;

    // ── Distance features ──
    let totalDistance = 0;
    for (let i = 1; i < n; i++) {
      totalDistance += haversine(
        window[i - 1].latitude, window[i - 1].longitude,
        window[i].latitude, window[i].longitude,
      );
    }

    const displacement = haversine(
      window[0].latitude, window[0].longitude,
      window[n - 1].latitude, window[n - 1].longitude,
    );

    const sinuosity = totalDistance / Math.max(displacement, 0.01);

    features[5] = totalDistance;
    features[6] = displacement;
    features[7] = sinuosity;

    // ── Altitude features ──
    const altitudes: number[] = [];
    for (let i = 0; i < n; i++) {
      altitudes.push(window[i].altitude ?? 0);
    }
    const altMean = mean(altitudes);
    const altStd = std(altitudes);
    const altDelta = altitudes[n - 1] - altitudes[0];

    let altGain = 0;
    let altLoss = 0;
    for (let i = 1; i < n; i++) {
      const diff = altitudes[i] - altitudes[i - 1];
      if (diff > 0) altGain += diff;
      else altLoss += Math.abs(diff);
    }

    features[8] = altMean;
    features[9] = altStd;
    features[10] = altDelta;
    features[11] = altGain;
    features[12] = altLoss;

    // ── Heading features (circular statistics) ──
    const sinValues: number[] = [];
    const cosValues: number[] = [];
    for (let i = 0; i < n; i++) {
      const hRad = ((window[i].heading ?? 0) * Math.PI) / 180;
      sinValues.push(Math.sin(hRad));
      cosValues.push(Math.cos(hRad));
    }
    const headingSinMean = mean(sinValues);
    const headingCosMean = mean(cosValues);
    const R = Math.sqrt(headingSinMean ** 2 + headingCosMean ** 2);
    const headingStd = 1.0 - R;

    features[13] = headingSinMean;
    features[14] = headingCosMean;
    features[15] = headingStd;

    // ── Acceleration proxy ──
    const accelerations: number[] = [];
    for (let i = 1; i < n; i++) {
      const dt = (window[i].timestamp - window[i - 1].timestamp) / 1000; // seconds
      if (dt > 0) {
        accelerations.push((speeds[i] - speeds[i - 1]) / dt);
      }
    }
    features[16] = mean(accelerations);
    features[17] = std(accelerations);

    // ── Temporal ──
    features[18] = (window[n - 1].timestamp - window[0].timestamp) / 1000;

    // ── Speed zero-crossings (proxy for step frequency) ──
    const detrended = speeds.map(s => s - speedMean);
    let zeroCrossings = 0;
    for (let i = 1; i < n; i++) {
      if (detrended[i - 1] * detrended[i] < 0) {
        zeroCrossings++;
      }
    }
    features[19] = zeroCrossings;

    return features;
  }

  /**
   * Apply StandardScaler (z-score normalization) from training.
   */
  private applyScaler(features: Float32Array, scaler: ScalerParams): Float32Array {
    const scaled = new Float32Array(NUM_FEATURES);
    for (let i = 0; i < NUM_FEATURES; i++) {
      const s = scaler.scale[i];
      scaled[i] = s !== 0 ? (features[i] - scaler.mean[i]) / s : 0;
    }
    return scaled;
  }

  /**
   * Get the current buffer size.
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Reset the buffer (e.g. when starting a new session).
   */
  reset(): void {
    this.buffer = [];
    this.stepCounter = 0;
  }
}
