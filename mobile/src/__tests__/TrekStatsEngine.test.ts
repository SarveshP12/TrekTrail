import { TrekStatsEngine } from '../services/tracking/TrekStatsEngine';
import { GPSReading } from '../services/location/LocationProvider';

function makeReading(
  lat: number,
  lon: number,
  alt: number | null = 100,
  timestamp: number = Date.now(),
  speed: number | null = null,
): GPSReading {
  return {
    latitude: lat,
    longitude: lon,
    altitude: alt,
    accuracy: 5,
    speed,
    heading: null,
    timestamp,
  };
}

describe('TrekStatsEngine', () => {
  let engine: TrekStatsEngine;

  beforeEach(() => {
    engine = new TrekStatsEngine(30000);
  });

  it('should start with empty stats', () => {
    const stats = engine.getStats();
    expect(stats.distance2D).toBe(0);
    expect(stats.distance3D).toBe(0);
    expect(stats.speed).toBe(0);
    expect(stats.avgSpeed).toBe(0);
    expect(stats.altitude).toBeNull();
    expect(stats.elevationGain).toBe(0);
    expect(stats.elevationLoss).toBe(0);
    expect(stats.pointCount).toBe(0);
    expect(stats.pace).toBeNull();
  });

  it('should count points', () => {
    engine.addReading(makeReading(0, 0));
    engine.addReading(makeReading(0, 0.001));
    engine.addReading(makeReading(0, 0.002));
    expect(engine.getStats().pointCount).toBe(3);
  });

  it('should accumulate distance', () => {
    engine.addReading(makeReading(0, 0, 100, 1000));
    engine.addReading(makeReading(0, 0.001, 100, 2000)); // ~111m

    const stats = engine.getStats();
    expect(stats.distance2D).toBeGreaterThan(50);
    expect(stats.distance3D).toBeGreaterThan(50);
  });

  it('should track elevation gain and loss', () => {
    engine.addReading(makeReading(0, 0, 100, 1000));
    engine.addReading(makeReading(0, 0.001, 150, 2000)); // +50m
    engine.addReading(makeReading(0, 0.002, 120, 3000)); // -30m

    const stats = engine.getStats();
    expect(stats.elevationGain).toBe(50);
    expect(stats.elevationLoss).toBe(30);
  });

  it('should track current altitude', () => {
    engine.addReading(makeReading(0, 0, 500));
    expect(engine.getStats().altitude).toBe(500);
  });

  it('should compute speed', () => {
    engine.addReading(makeReading(0, 0, 100, 0));
    engine.addReading(makeReading(0, 0.001, 100, 10000)); // ~111m in 10s

    const stats = engine.getStats();
    expect(stats.speed).toBeGreaterThan(0);
    expect(stats.avgSpeed).toBeGreaterThan(0);
  });

  it('should compute pace when moving', () => {
    // Two readings ~111m apart in 10s => ~11 m/s => pace ~1.5 min/km
    engine.addReading(makeReading(0, 0, 100, 0));
    engine.addReading(makeReading(0, 0.001, 100, 10000));

    const stats = engine.getStats();
    expect(stats.pace).not.toBeNull();
    expect(stats.pace!).toBeGreaterThan(0);
  });

  it('should track duration when started', () => {
    engine.start();

    // Manually move time forward
    const stats = engine.getStats();
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle pause/resume', () => {
    jest.useFakeTimers();

    engine.start();
    jest.advanceTimersByTime(5000);

    engine.pause();
    jest.advanceTimersByTime(10000); // paused — shouldn't count

    engine.resume();
    jest.advanceTimersByTime(5000);

    const stats = engine.getStats();
    // Should be ~10s (5s + 5s active), not 20s
    expect(stats.durationMs).toBeLessThan(15000);
    expect(stats.durationMs).toBeGreaterThanOrEqual(9000);

    jest.useRealTimers();
  });

  it('should track min/max altitude', () => {
    engine.addReading(makeReading(0, 0, 200, 1000));
    engine.addReading(makeReading(0, 0.001, 50, 2000));
    engine.addReading(makeReading(0, 0.002, 300, 3000));

    const stats = engine.getStats();
    expect(stats.minAltitude).toBe(50);
    expect(stats.maxAltitude).toBe(300);
  });

  it('should reset all stats', () => {
    engine.addReading(makeReading(0, 0, 100, 1000));
    engine.addReading(makeReading(0, 0.001, 200, 2000));

    engine.reset();

    const stats = engine.getStats();
    expect(stats.distance2D).toBe(0);
    expect(stats.pointCount).toBe(0);
    expect(stats.elevationGain).toBe(0);
    expect(stats.altitude).toBeNull();
  });
});
