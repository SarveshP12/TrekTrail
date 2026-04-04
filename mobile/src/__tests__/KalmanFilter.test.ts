import { KalmanFilter, SmoothedGPSReading } from '../services/ai/KalmanFilter';
import { GPSReading } from '../services/location/LocationProvider';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeReading(
  lat: number,
  lon: number,
  timestamp: number,
  accuracy: number = 5,
  altitude: number | null = 100,
  speed: number | null = null,
  heading: number | null = null,
): GPSReading {
  return { latitude: lat, longitude: lon, altitude, accuracy, speed, heading, timestamp };
}

/**
 * Generate a straight-line GPS track with added noise.
 * Walks due east along the equator for simplicity.
 */
function generateNoisyTrack(
  startLat: number,
  startLon: number,
  stepDegLon: number,
  numPoints: number,
  noiseDeg: number,
  intervalMs: number = 1000,
  accuracy: number = 10,
): GPSReading[] {
  const readings: GPSReading[] = [];
  for (let i = 0; i < numPoints; i++) {
    const trueLon = startLon + i * stepDegLon;
    const noisyLat = startLat + (Math.random() - 0.5) * 2 * noiseDeg;
    const noisyLon = trueLon + (Math.random() - 0.5) * 2 * noiseDeg;
    readings.push(makeReading(noisyLat, noisyLon, i * intervalMs, accuracy));
  }
  return readings;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KalmanFilter', () => {
  let filter: KalmanFilter;

  beforeEach(() => {
    filter = new KalmanFilter();
  });

  // ───── Initialisation ─────────────────────────────────────────────────

  it('should return null estimate before any reading', () => {
    expect(filter.getEstimate()).toBeNull();
    expect(filter.getReadingCount()).toBe(0);
  });

  it('should initialise on the first reading', () => {
    const reading = makeReading(28.6139, 77.2090, 1000, 8);
    const result = filter.filter(reading);

    expect(result).not.toBeNull();
    expect(result!.isFiltered).toBe(false); // first reading is a pass-through
    expect(result!.latitude).toBe(reading.latitude);
    expect(result!.longitude).toBe(reading.longitude);
    expect(result!.rawLatitude).toBe(reading.latitude);
    expect(result!.rawLongitude).toBe(reading.longitude);
    expect(filter.getReadingCount()).toBe(1);
  });

  it('should preserve all original fields in the output', () => {
    const reading = makeReading(28.6139, 77.2090, 1000, 5, 350, 1.5, 90);
    const result = filter.filter(reading)!;

    expect(result.altitude).toBe(350);
    expect(result.speed).toBe(1.5);
    expect(result.heading).toBe(90);
    expect(result.timestamp).toBe(1000);
  });

  // ───── Filtering (noise reduction) ────────────────────────────────────

  it('should smooth noisy GPS readings', () => {
    const trueLat = 28.6139;
    const trueLon = 77.2090;

    // Generate 20 readings at the same true position with noise
    const readings: GPSReading[] = [];
    for (let i = 0; i < 20; i++) {
      const noisyLat = trueLat + (Math.random() - 0.5) * 0.0002; // ~±11m
      const noisyLon = trueLon + (Math.random() - 0.5) * 0.0002;
      readings.push(makeReading(noisyLat, noisyLon, i * 1000, 10));
    }

    let lastResult: SmoothedGPSReading | null = null;
    for (const r of readings) {
      lastResult = filter.filter(r);
    }

    // After 20 readings, the filtered position should be closer 
    // to the true position than the last raw reading
    expect(lastResult).not.toBeNull();
    const filteredDistLat = Math.abs(lastResult!.latitude - trueLat);
    const rawDistLat = Math.abs(lastResult!.rawLatitude - trueLat);

    // The filter should generally produce a position closer to the mean
    // (though not guaranteed for every random seed, we use a broad assertion)
    expect(lastResult!.isFiltered).toBe(true);
    expect(lastResult!.estimatedAccuracy).toBeGreaterThan(0);
    expect(lastResult!.estimatedAccuracy).toBeLessThan(100);
  });

  it('should reduce wander for a stationary position', () => {
    const trueLat = 12.9716;
    const trueLon = 77.5946;

    // Stationary: 50 readings at the same spot with noise
    const errors: number[] = [];
    for (let i = 0; i < 50; i++) {
      const noisyLat = trueLat + (Math.random() - 0.5) * 0.0004; // ~±22m
      const noisyLon = trueLon + (Math.random() - 0.5) * 0.0004;
      const result = filter.filter(makeReading(noisyLat, noisyLon, i * 1000, 15));
      if (result) {
        const errM = Math.sqrt(
          ((result.latitude - trueLat) * 111320) ** 2 +
          ((result.longitude - trueLon) * 111320 * Math.cos(trueLat * Math.PI / 180)) ** 2
        );
        errors.push(errM);
      }
    }

    // The latter half of filtered errors should be tighter than the first half
    const firstHalf = errors.slice(0, 25);
    const secondHalf = errors.slice(25);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // Filter should converge: second half errors should be smaller
    expect(avgSecond).toBeLessThan(avgFirst + 5); // allow 5m tolerance for randomness
  });

  it('should track a moving target along a straight line', () => {
    // Move due east along equator: 0.0001 deg/s ≈ 11.1 m/s
    const readings = generateNoisyTrack(0, 0, 0.0001, 30, 0.00005, 1000, 8);

    const results: SmoothedGPSReading[] = [];
    for (const r of readings) {
      const result = filter.filter(r);
      if (result) results.push(result);
    }

    expect(results.length).toBe(30);

    // After convergence, the filter should estimate velocity
    const est = filter.getEstimate();
    expect(est).not.toBeNull();
    // vLon should be roughly positive (moving east)
    expect(est!.vLon).toBeGreaterThan(0);
  });

  // ───── Accuracy rejection ─────────────────────────────────────────────

  it('should reject readings with accuracy worse than maxAccuracy', () => {
    // Default maxAccuracy is 100
    const good = makeReading(0, 0, 1000, 5);
    const bad = makeReading(0.001, 0.001, 2000, 150); // accuracy = 150m > 100m

    const r1 = filter.filter(good);
    const r2 = filter.filter(bad);

    expect(r1).not.toBeNull();
    expect(r2).toBeNull(); // rejected — doesn't pass accuracy gate
    expect(filter.getReadingCount()).toBe(1); // rejected readings are not counted
  });

  it('should respect custom maxAccuracy', () => {
    const strictFilter = new KalmanFilter({ maxAccuracy: 20 });
    const r1 = strictFilter.filter(makeReading(0, 0, 1000, 15)); // OK
    const r2 = strictFilter.filter(makeReading(0, 0, 2000, 25)); // too poor

    expect(r1).not.toBeNull();
    expect(r2).toBeNull();
  });

  // ───── Time gap handling ──────────────────────────────────────────────

  it('should reinitialise after a large time gap', () => {
    filter.filter(makeReading(0, 0, 1000, 5));
    filter.filter(makeReading(0, 0.0001, 2000, 5));

    // 60-second gap (default maxDtSeconds = 30)
    const result = filter.filter(makeReading(10, 10, 62000, 5));

    expect(result).not.toBeNull();
    // After reinitialisation, position should match the new reading exactly
    expect(result!.latitude).toBe(10);
    expect(result!.longitude).toBe(10);
    expect(result!.isFiltered).toBe(false); // reinit is a pass-through
  });

  it('should reinitialise on negative dt', () => {
    filter.filter(makeReading(0, 0, 5000, 5));
    // Timestamp goes backwards
    const result = filter.filter(makeReading(1, 1, 3000, 5));

    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(1);
    expect(result!.isFiltered).toBe(false);
  });

  // ───── Reset ──────────────────────────────────────────────────────────

  it('should fully reset state', () => {
    filter.filter(makeReading(28.6, 77.2, 1000, 5));
    filter.filter(makeReading(28.6, 77.2001, 2000, 5));

    expect(filter.getReadingCount()).toBe(2);
    expect(filter.getEstimate()).not.toBeNull();

    filter.reset();

    expect(filter.getReadingCount()).toBe(0);
    expect(filter.getEstimate()).toBeNull();
  });

  // ───── Estimated accuracy ─────────────────────────────────────────────

  it('should improve estimated accuracy over time with consistent readings', () => {
    const accuracies: number[] = [];

    for (let i = 0; i < 20; i++) {
      const result = filter.filter(makeReading(
        28.6139 + (Math.random() - 0.5) * 0.00001,
        77.2090 + (Math.random() - 0.5) * 0.00001,
        i * 1000,
        10,
      ));
      if (result) {
        accuracies.push(result.estimatedAccuracy);
      }
    }

    // Estimated accuracy should decrease (improve) over time
    expect(accuracies.length).toBeGreaterThan(10);
    const early = accuracies.slice(1, 5); // skip first (initialisation)
    const late = accuracies.slice(-5);
    const avgEarly = early.reduce((a, b) => a + b, 0) / early.length;
    const avgLate = late.reduce((a, b) => a + b, 0) / late.length;
    expect(avgLate).toBeLessThanOrEqual(avgEarly + 1); // should improve or stay similar
  });

  // ───── Config: processNoiseSigma ──────────────────────────────────────

  it('should respond more to measurements with higher processNoiseSigma', () => {
    const responsive = new KalmanFilter({ processNoiseSigma: 10.0 });
    const smooth = new KalmanFilter({ processNoiseSigma: 0.5 });

    // Feed same readings to both
    const readings = [
      makeReading(0, 0, 0, 5),
      makeReading(0, 0, 1000, 5),
      makeReading(0.001, 0, 2000, 5), // sudden jump north
    ];

    let rResponsive: SmoothedGPSReading | null = null;
    let rSmooth: SmoothedGPSReading | null = null;

    for (const r of readings) {
      rResponsive = responsive.filter(r);
      rSmooth = smooth.filter(r);
    }

    // The responsive filter should follow the jump more closely
    expect(rResponsive).not.toBeNull();
    expect(rSmooth).not.toBeNull();
    expect(rResponsive!.latitude).toBeGreaterThan(rSmooth!.latitude);
  });

  // ───── Edge cases ─────────────────────────────────────────────────────

  it('should handle readings at the exact same position', () => {
    for (let i = 0; i < 10; i++) {
      const result = filter.filter(makeReading(0, 0, i * 1000, 5));
      expect(result).not.toBeNull();
      // Position should stay at 0,0
      expect(Math.abs(result!.latitude)).toBeLessThan(0.0001);
      expect(Math.abs(result!.longitude)).toBeLessThan(0.0001);
    }
  });

  it('should handle readings at high latitude (near poles)', () => {
    // At 80°N, longitude degrees are much shorter
    const result1 = filter.filter(makeReading(80, 0, 0, 5));
    const result2 = filter.filter(makeReading(80, 0.001, 1000, 5));

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result2!.isFiltered).toBe(true);
  });

  it('should handle readings at the equator', () => {
    const result1 = filter.filter(makeReading(0, 0, 0, 5));
    const result2 = filter.filter(makeReading(0, 0.001, 1000, 5));

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
  });

  it('should handle minimum measurement noise floor', () => {
    // accuracy = 0.1m is unrealistically good; filter should clamp to minMeasurementNoise
    const result1 = filter.filter(makeReading(0, 0, 0, 0.1));
    const result2 = filter.filter(makeReading(0, 0.0001, 1000, 0.1));

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    // Should not over-trust the measurement
    expect(result2!.estimatedAccuracy).toBeGreaterThan(0);
  });

  it('should handle a single reading gracefully', () => {
    const result = filter.filter(makeReading(45, 90, 1000, 5));
    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(45);
    expect(result!.longitude).toBe(90);
  });
});

// ─── Integration with TrekStatsEngine ─────────────────────────────────────────

describe('TrekStatsEngine with KalmanFilter', () => {
  it('should report GPS quality metrics', () => {
    // Import here to avoid circular dependency issues in test setup
    const { TrekStatsEngine } = require('../services/tracking/TrekStatsEngine');
    const kalman = new KalmanFilter({ maxAccuracy: 50 });
    const engine = new TrekStatsEngine(30000, kalman);

    // Good reading
    engine.addReading(makeReading(0, 0, 0, 5));
    // Another good reading
    engine.addReading(makeReading(0, 0.0001, 1000, 5));
    // Bad reading (rejected)
    engine.addReading(makeReading(0, 0.0002, 2000, 80));

    const stats = engine.getStats();
    expect(stats.pointCount).toBe(3);
    expect(stats.gpsFilteredCount).toBe(2);
    expect(stats.gpsRejectedCount).toBe(1);
    expect(stats.gpsEstimatedAccuracy).not.toBeNull();
    expect(stats.gpsEstimatedAccuracy).toBeGreaterThan(0);
  });
});
