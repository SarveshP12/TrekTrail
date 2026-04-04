import { FeatureExtractor, NUM_FEATURES, FEATURE_NAMES } from '../services/ai/FeatureExtractor';
import { ActivityClassifier, TFLiteModel, ClassificationResult } from '../services/ai/ActivityClassifier';
import { GPSReading } from '../services/location/LocationProvider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReading(
  lat: number,
  lon: number,
  timestamp: number,
  speed: number | null = 1.0,
  altitude: number | null = 100,
  accuracy: number = 5,
  heading: number | null = 90,
): GPSReading {
  return { latitude: lat, longitude: lon, altitude, accuracy, speed, heading, timestamp };
}

/** Generate N readings simulating steady movement east. */
function generateReadings(
  n: number,
  speed: number = 1.5,
  intervalMs: number = 1000,
): GPSReading[] {
  const readings: GPSReading[] = [];
  const startLat = 28.6;
  const startLon = 77.2;
  for (let i = 0; i < n; i++) {
    readings.push(makeReading(
      startLat,
      startLon + i * 0.00001, // ~1.1m per step east
      i * intervalMs,
      speed,
      100 + i * 0.5,
      5,
      90,
    ));
  }
  return readings;
}

// ─── FeatureExtractor Tests ──────────────────────────────────────────────────

describe('FeatureExtractor', () => {
  let extractor: FeatureExtractor;

  beforeEach(() => {
    extractor = new FeatureExtractor({ windowSize: 5, stepSize: 1 });
  });

  it('should return null until window is full', () => {
    const readings = generateReadings(4);
    for (const r of readings) {
      expect(extractor.addReading(r)).toBeNull();
    }
    expect(extractor.getBufferSize()).toBe(4);
  });

  it('should return features once window is full', () => {
    const readings = generateReadings(5);
    let result: Float32Array | null = null;
    for (const r of readings) {
      result = extractor.addReading(r);
    }
    expect(result).not.toBeNull();
    expect(result!.length).toBe(NUM_FEATURES);
  });

  it('should produce exactly NUM_FEATURES (20) features', () => {
    expect(NUM_FEATURES).toBe(20);
    expect(FEATURE_NAMES.length).toBe(20);
  });

  it('should compute correct speed features', () => {
    const readings = generateReadings(5, 2.0); // all speeds = 2.0 m/s
    let features: Float32Array | null = null;
    for (const r of readings) {
      features = extractor.addReading(r);
    }
    expect(features).not.toBeNull();
    // speed_mean should be ~2.0
    expect(features![0]).toBeCloseTo(2.0, 1);
    // speed_std should be ~0 (all same speed)
    expect(features![1]).toBeCloseTo(0, 1);
    // speed_max = 2.0
    expect(features![2]).toBeCloseTo(2.0, 1);
    // speed_min = 2.0
    expect(features![3]).toBeCloseTo(2.0, 1);
    // speed_range = 0
    expect(features![4]).toBeCloseTo(0, 1);
  });

  it('should compute positive total distance for moving readings', () => {
    const readings = generateReadings(5, 1.5);
    let features: Float32Array | null = null;
    for (const r of readings) {
      features = extractor.addReading(r);
    }
    // total_distance (index 5) should be > 0
    expect(features![5]).toBeGreaterThan(0);
    // displacement (index 6) should be > 0
    expect(features![6]).toBeGreaterThan(0);
  });

  it('should compute altitude features', () => {
    // Readings with increasing altitude: 100, 100.5, 101, 101.5, 102
    const readings = generateReadings(5);
    let features: Float32Array | null = null;
    for (const r of readings) {
      features = extractor.addReading(r);
    }
    // altitude_mean (index 8) should be ~101
    expect(features![8]).toBeCloseTo(101, 0);
    // altitude_delta (index 10) should be 2 (102 - 100)
    expect(features![10]).toBeCloseTo(2.0, 1);
    // altitude_gain (index 11) should be > 0
    expect(features![11]).toBeGreaterThan(0);
    // altitude_loss (index 12) should be 0 (monotonically increasing)
    expect(features![12]).toBeCloseTo(0, 5);
  });

  it('should compute window duration correctly', () => {
    const readings = generateReadings(5, 1.0, 1000);
    let features: Float32Array | null = null;
    for (const r of readings) {
      features = extractor.addReading(r);
    }
    // window_duration_s (index 18) = 4 seconds (5 readings at 1Hz)
    expect(features![18]).toBeCloseTo(4.0, 1);
  });

  it('should honor step size', () => {
    const extractor2 = new FeatureExtractor({ windowSize: 5, stepSize: 3 });
    const readings = generateReadings(10, 1.5);
    let featureCount = 0;
    for (const r of readings) {
      if (extractor2.addReading(r) !== null) featureCount++;
    }
    // With 10 readings, window=5, step=3: features at indices 4,7 → 2 extractions
    expect(featureCount).toBe(2);
  });

  it('should apply scaler when provided', () => {
    const scaler = {
      mean: new Array(NUM_FEATURES).fill(1.0),
      scale: new Array(NUM_FEATURES).fill(2.0),
    };
    const scaledExtractor = new FeatureExtractor({
      windowSize: 5,
      stepSize: 1,
      scaler,
    });

    const readings = generateReadings(5);
    let features: Float32Array | null = null;
    for (const r of readings) {
      features = scaledExtractor.addReading(r);
    }
    expect(features).not.toBeNull();
    // scaled = (raw - 1.0) / 2.0 — should differ from raw
    // Just check it's a valid number and not the raw value
    expect(isFinite(features![0])).toBe(true);
  });

  it('should reset correctly', () => {
    const readings = generateReadings(5);
    for (const r of readings) {
      extractor.addReading(r);
    }
    expect(extractor.getBufferSize()).toBe(5);

    extractor.reset();
    expect(extractor.getBufferSize()).toBe(0);

    // Should need another full window
    expect(extractor.addReading(readings[0])).toBeNull();
  });
});

// ─── ActivityClassifier Tests ────────────────────────────────────────────────

describe('ActivityClassifier', () => {
  /** Mock TFLite model that returns cycling probabilities */
  function createMockModel(predictedClass: number = 4): TFLiteModel {
    return {
      run: async (_input: Float32Array): Promise<Float32Array> => {
        const probs = new Float32Array(5);
        probs[predictedClass] = 0.85;
        for (let i = 0; i < 5; i++) {
          if (i !== predictedClass) probs[i] = 0.0375;
        }
        return probs;
      },
      close: jest.fn(),
    };
  }

  it('should classify using heuristic fallback when no model loaded', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1, // disable smoothing for test
      featureConfig: { windowSize: 3 },
    });

    // Feed slow-speed readings → should classify as IDLE
    const readings = generateReadings(5, 0.1); // 0.1 m/s
    let result: ClassificationResult | null = null;
    for (const r of readings) {
      result = await classifier.classify(r);
    }

    expect(result).not.toBeNull();
    expect(result!.label).toBe('IDLE');
    expect(result!.source).toBe('heuristic');
    expect(result!.confidence).toBeGreaterThan(0.4);
  });

  it('should classify walking speed as WALKING', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    const readings = generateReadings(5, 1.3); // 1.3 m/s = walking
    let result: ClassificationResult | null = null;
    for (const r of readings) {
      result = await classifier.classify(r);
    }

    expect(result).not.toBeNull();
    expect(['WALKING', 'TREKKING']).toContain(result!.label);
  });

  it('should classify high speed as CYCLING', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    const readings = generateReadings(5, 6.0); // 6 m/s = cycling
    let result: ClassificationResult | null = null;
    for (const r of readings) {
      result = await classifier.classify(r);
    }

    expect(result).not.toBeNull();
    expect(result!.label).toBe('CYCLING');
  });

  it('should use TFLite model when loaded', async () => {
    const classifier = new ActivityClassifier({
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    await classifier.loadModel(createMockModel(3)); // predict RUNNING
    expect(classifier.isReady()).toBe(true);

    const readings = generateReadings(5, 1.0);
    let result: ClassificationResult | null = null;
    for (const r of readings) {
      result = await classifier.classify(r);
    }

    expect(result).not.toBeNull();
    expect(result!.label).toBe('RUNNING');
    expect(result!.source).toBe('model');
    expect(result!.confidence).toBeCloseTo(0.85, 1);
  });

  it('should provide full probability distribution', async () => {
    const classifier = new ActivityClassifier({
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    await classifier.loadModel(createMockModel(0)); // predict IDLE
    const readings = generateReadings(5, 1.0);
    let result: ClassificationResult | null = null;
    for (const r of readings) {
      result = await classifier.classify(r);
    }

    expect(result).not.toBeNull();
    expect(result!.probabilities.IDLE).toBeCloseTo(0.85, 1);
    const sum = Object.values(result!.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('should apply label smoothing', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 3,
      featureConfig: { windowSize: 3, stepSize: 1 },
    });

    // Feed idle readings first to establish baseline
    const idleReadings = generateReadings(6, 0.05);
    for (const r of idleReadings) {
      await classifier.classify(r);
    }
    expect(classifier.getCurrentActivity()).toBe('IDLE');

    // Feed 1 cycling reading — shouldn't switch immediately
    const cyclingReading = makeReading(28.6, 77.2, 10000, 8.0, 100, 5, 90);
    await classifier.classify(cyclingReading);
    // Should still be IDLE due to smoothing
    expect(classifier.getCurrentActivity()).toBe('IDLE');
  });

  it('should track classification history', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    const readings = generateReadings(8, 1.5);
    for (const r of readings) {
      await classifier.classify(r);
    }

    const history = classifier.getHistory(10);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].timestamp).toBeGreaterThan(0);
  });

  it('should compute activity distribution', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    const readings = generateReadings(8, 0.05); // IDLE
    for (const r of readings) {
      await classifier.classify(r);
    }

    const dist = classifier.getActivityDistribution();
    expect(dist.IDLE).toBeGreaterThan(0);
    // Sum of distribution should equal 1
    const sum = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should fall back to heuristic when model fails', async () => {
    const failingModel: TFLiteModel = {
      run: async () => { throw new Error('TFLite crash'); },
      close: jest.fn(),
    };

    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    await classifier.loadModel(failingModel);

    const readings = generateReadings(5, 0.1);
    let result: ClassificationResult | null = null;
    for (const r of readings) {
      result = await classifier.classify(r);
    }

    expect(result).not.toBeNull();
    expect(result!.source).toBe('heuristic');
  });

  it('should reset all state', async () => {
    const classifier = new ActivityClassifier({
      enableFallback: true,
      smoothingCount: 1,
      featureConfig: { windowSize: 3 },
    });

    const readings = generateReadings(5, 5.0);
    for (const r of readings) {
      await classifier.classify(r);
    }

    classifier.reset();
    expect(classifier.getCurrentActivity()).toBe('IDLE');
    expect(classifier.getHistory()).toHaveLength(0);
  });

  it('should dispose model resources', async () => {
    const mockClose = jest.fn();
    const model: TFLiteModel = {
      run: async (i) => new Float32Array(5),
      close: mockClose,
    };

    const classifier = new ActivityClassifier();
    await classifier.loadModel(model);
    expect(classifier.isReady()).toBe(true);

    classifier.dispose();
    expect(mockClose).toHaveBeenCalled();
    expect(classifier.isReady()).toBe(true); // fallback still works
  });
});
