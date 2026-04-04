/**
 * ActivityClassifier.ts — On-Device Activity Classification via TFLite
 *
 * Loads the exported .tflite model and performs on-device inference
 * to classify the user's current activity type.
 *
 * Supported activities: IDLE, WALKING, TREKKING, RUNNING, CYCLING
 *
 * Architecture:
 *   GPSReading → FeatureExtractor → ActivityClassifier → ActivityLabel
 *
 * Uses react-native-tflite for model loading and inference.
 * Falls back to a heuristic classifier if TFLite is unavailable.
 */

import { GPSReading } from '../location/LocationProvider';
import {
  FeatureExtractor,
  FeatureExtractionConfig,
  ScalerParams,
  ACTIVITY_LABELS,
  ActivityLabel,
  NUM_CLASSES,
  NUM_FEATURES,
} from './FeatureExtractor';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  /** Predicted activity label */
  label: ActivityLabel;
  /** Confidence score (0-1) for the predicted class */
  confidence: number;
  /** Full probability distribution across all classes */
  probabilities: Record<ActivityLabel, number>;
  /** Timestamp of the classification */
  timestamp: number;
  /** Whether this was produced by the ML model or heuristic fallback */
  source: 'model' | 'heuristic';
}

export interface ActivityClassifierConfig {
  /** Path to the .tflite model file (in app assets) */
  modelPath?: string;
  /** Minimum confidence threshold to report a classification */
  confidenceThreshold: number;
  /** Feature extraction config */
  featureConfig: Partial<FeatureExtractionConfig>;
  /** StandardScaler parameters from training */
  scaler?: ScalerParams;
  /** Enable heuristic fallback if TFLite loading fails */
  enableFallback: boolean;
  /** Smoothing: minimum consecutive readings for a class change */
  smoothingCount: number;
}

const DEFAULT_CONFIG: ActivityClassifierConfig = {
  confidenceThreshold: 0.4,
  featureConfig: { windowSize: 5, stepSize: 1 },
  enableFallback: true,
  smoothingCount: 3,
};

// ─── TFLite Interface (abstracted for testability) ───────────────────────────

/**
 * Abstract interface for TFLite model invocation.
 * In production, this wraps react-native-tflite.
 * In tests, it can be mocked.
 */
export interface TFLiteModel {
  /** Run inference on a float32 input. Returns output probabilities. */
  run(input: Float32Array): Promise<Float32Array>;
  /** Release model resources. */
  close(): void;
}

// ─── Heuristic Classifier ────────────────────────────────────────────────────

/**
 * Simple rule-based classifier as a fallback when TFLite is unavailable.
 * Uses speed thresholds to estimate activity type.
 */
function heuristicClassify(features: Float32Array): Float32Array {
  const speedMean = features[0];       // index 0 = speed_mean
  const speedStd = features[1];        // index 1 = speed_std
  const altitudeGain = features[11];   // index 11 = altitude_gain
  const sinuosity = features[7];       // index 7 = sinuosity

  const probs = new Float32Array(NUM_CLASSES);

  if (speedMean < 0.3) {
    // IDLE
    probs[0] = 0.85;
    probs[1] = 0.10;
    probs[2] = 0.05;
  } else if (speedMean < 1.8) {
    // WALKING or TREKKING
    if (altitudeGain > 1.0 || sinuosity > 1.5) {
      // TREKKING (more elevation or winding path)
      probs[2] = 0.70;
      probs[1] = 0.20;
      probs[3] = 0.05;
      probs[0] = 0.05;
    } else {
      // WALKING
      probs[1] = 0.70;
      probs[2] = 0.20;
      probs[0] = 0.05;
      probs[3] = 0.05;
    }
  } else if (speedMean < 4.0) {
    // RUNNING
    probs[3] = 0.70;
    probs[1] = 0.10;
    probs[4] = 0.15;
    probs[2] = 0.05;
  } else {
    // CYCLING
    probs[4] = 0.80;
    probs[3] = 0.15;
    probs[1] = 0.05;
  }

  return probs;
}

// ─── Activity Classifier ─────────────────────────────────────────────────────

/**
 * On-device activity classifier.
 *
 * Usage:
 * ```ts
 * const classifier = new ActivityClassifier({
 *   scaler: scalerParams, // loaded from training export
 * });
 *
 * // Optionally load TFLite model
 * await classifier.loadModel(tfliteModel);
 *
 * // In the GPS callback:
 * const result = await classifier.classify(gpsReading);
 * if (result) {
 *   console.log(`Activity: ${result.label} (${result.confidence})`);
 * }
 * ```
 */
export class ActivityClassifier {
  private config: ActivityClassifierConfig;
  private featureExtractor: FeatureExtractor;
  private model: TFLiteModel | null = null;
  private isModelLoaded: boolean = false;

  // Smoothing state
  private lastLabel: ActivityLabel = 'IDLE';
  private labelStreak: number = 0;
  private confirmedLabel: ActivityLabel = 'IDLE';

  // History for analytics
  private classificationHistory: ClassificationResult[] = [];
  private maxHistorySize: number = 100;

  constructor(config: Partial<ActivityClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.featureExtractor = new FeatureExtractor({
      ...this.config.featureConfig,
      scaler: this.config.scaler,
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Load a TFLite model for on-device inference.
   */
  async loadModel(model: TFLiteModel): Promise<void> {
    this.model = model;
    this.isModelLoaded = true;
    console.log('[ActivityClassifier] TFLite model loaded');
  }

  /**
   * Feed a GPS reading and get a classification result.
   *
   * @returns ClassificationResult if a full window produced a prediction,
   *          null otherwise (waiting for more readings).
   */
  async classify(reading: GPSReading): Promise<ClassificationResult | null> {
    // Extract features from the sliding window
    const features = this.featureExtractor.addReading(reading);
    if (!features) return null;

    // Run inference
    let probabilities: Float32Array;
    let source: 'model' | 'heuristic';

    if (this.isModelLoaded && this.model) {
      try {
        probabilities = await this.model.run(features);
        source = 'model';
      } catch (err) {
        console.warn('[ActivityClassifier] TFLite inference failed, using fallback:', err);
        probabilities = heuristicClassify(features);
        source = 'heuristic';
      }
    } else if (this.config.enableFallback) {
      probabilities = heuristicClassify(features);
      source = 'heuristic';
    } else {
      return null;
    }

    // Find the predicted class
    let maxIdx = 0;
    let maxProb = probabilities[0];
    for (let i = 1; i < NUM_CLASSES; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        maxIdx = i;
      }
    }

    const rawLabel = ACTIVITY_LABELS[maxIdx];

    // Apply smoothing (require consecutive predictions before switching)
    const smoothedLabel = this.applySmoothing(rawLabel);

    // Check confidence threshold
    if (maxProb < this.config.confidenceThreshold) {
      return null;
    }

    // Build result
    const result: ClassificationResult = {
      label: smoothedLabel,
      confidence: maxProb,
      probabilities: {
        IDLE: probabilities[0],
        WALKING: probabilities[1],
        TREKKING: probabilities[2],
        RUNNING: probabilities[3],
        CYCLING: probabilities[4],
      },
      timestamp: reading.timestamp,
      source,
    };

    // Store in history
    this.classificationHistory.push(result);
    if (this.classificationHistory.length > this.maxHistorySize) {
      this.classificationHistory.shift();
    }

    return result;
  }

  /**
   * Get the current confirmed activity label.
   */
  getCurrentActivity(): ActivityLabel {
    return this.confirmedLabel;
  }

  /**
   * Get classification history (most recent first).
   */
  getHistory(limit: number = 20): ClassificationResult[] {
    return this.classificationHistory.slice(-limit).reverse();
  }

  /**
   * Get activity distribution from history.
   */
  getActivityDistribution(): Record<ActivityLabel, number> {
    const dist: Record<ActivityLabel, number> = {
      IDLE: 0, WALKING: 0, TREKKING: 0, RUNNING: 0, CYCLING: 0,
    };

    const total = this.classificationHistory.length;
    if (total === 0) return dist;

    for (const result of this.classificationHistory) {
      dist[result.label]++;
    }

    for (const label of ACTIVITY_LABELS) {
      dist[label] = dist[label] / total;
    }

    return dist;
  }

  /**
   * Whether the TFLite model is loaded and ready.
   */
  isReady(): boolean {
    return this.isModelLoaded || this.config.enableFallback;
  }

  /**
   * Reset classifier state (for new trek session).
   */
  reset(): void {
    this.featureExtractor.reset();
    this.lastLabel = 'IDLE';
    this.labelStreak = 0;
    this.confirmedLabel = 'IDLE';
    this.classificationHistory = [];
  }

  /**
   * Release model resources.
   */
  dispose(): void {
    if (this.model) {
      this.model.close();
      this.model = null;
      this.isModelLoaded = false;
    }
  }

  // ─── Internal: Label smoothing ────────────────────────────────────────

  private applySmoothing(rawLabel: ActivityLabel): ActivityLabel {
    if (rawLabel === this.lastLabel) {
      this.labelStreak++;
    } else {
      this.lastLabel = rawLabel;
      this.labelStreak = 1;
    }

    // Only confirm a label change after enough consecutive predictions
    if (this.labelStreak >= this.config.smoothingCount) {
      this.confirmedLabel = rawLabel;
    }

    return this.confirmedLabel;
  }
}
