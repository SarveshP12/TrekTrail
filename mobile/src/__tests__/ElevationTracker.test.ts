import { ElevationTracker } from '../services/tracking/ElevationTracker';
import { GPSReading } from '../services/location/LocationProvider';

function makeReading(
  altitude: number | null,
  timestamp: number = Date.now(),
): GPSReading {
  return {
    latitude: 0,
    longitude: 0,
    altitude,
    accuracy: 5,
    speed: null,
    heading: null,
    timestamp,
  };
}

describe('ElevationTracker', () => {
  let tracker: ElevationTracker;

  beforeEach(() => {
    tracker = new ElevationTracker();
  });

  it('should start with all values null/zero', () => {
    expect(tracker.getGain()).toBe(0);
    expect(tracker.getLoss()).toBe(0);
    expect(tracker.getCurrentAltitude()).toBeNull();
    expect(tracker.getMinAltitude()).toBeNull();
    expect(tracker.getMaxAltitude()).toBeNull();
  });

  it('should track current altitude', () => {
    tracker.addReading(makeReading(100));
    expect(tracker.getCurrentAltitude()).toBe(100);

    tracker.addReading(makeReading(200));
    expect(tracker.getCurrentAltitude()).toBe(200);
  });

  it('should track elevation gain', () => {
    tracker.addReading(makeReading(100));
    tracker.addReading(makeReading(150)); // +50m (above threshold)
    tracker.addReading(makeReading(200)); // +50m

    expect(tracker.getGain()).toBe(100);
  });

  it('should track elevation loss', () => {
    tracker.addReading(makeReading(200));
    tracker.addReading(makeReading(150)); // -50m
    tracker.addReading(makeReading(100)); // -50m

    expect(tracker.getLoss()).toBe(100);
  });

  it('should filter small altitude noise (< 1.5m threshold)', () => {
    tracker.addReading(makeReading(100));
    tracker.addReading(makeReading(100.5)); // +0.5m — below threshold
    tracker.addReading(makeReading(101));   // +1.0m from 100 — still below threshold

    expect(tracker.getGain()).toBe(0);
  });

  it('should track min and max altitude', () => {
    tracker.addReading(makeReading(100));
    tracker.addReading(makeReading(200));
    tracker.addReading(makeReading(50));
    tracker.addReading(makeReading(150));

    expect(tracker.getMinAltitude()).toBe(50);
    expect(tracker.getMaxAltitude()).toBe(200);
  });

  it('should ignore null altitude readings', () => {
    tracker.addReading(makeReading(null));
    tracker.addReading(makeReading(null));

    expect(tracker.getCurrentAltitude()).toBeNull();
    expect(tracker.getGain()).toBe(0);
    expect(tracker.getLoss()).toBe(0);
  });

  it('should handle mixed null and valid altitude readings', () => {
    tracker.addReading(makeReading(100));
    tracker.addReading(makeReading(null)); // skip
    tracker.addReading(makeReading(150)); // +50m from 100

    expect(tracker.getGain()).toBe(50);
    expect(tracker.getCurrentAltitude()).toBe(150);
  });

  it('should reset correctly', () => {
    tracker.addReading(makeReading(100));
    tracker.addReading(makeReading(200));

    tracker.reset();

    expect(tracker.getGain()).toBe(0);
    expect(tracker.getLoss()).toBe(0);
    expect(tracker.getCurrentAltitude()).toBeNull();
    expect(tracker.getMinAltitude()).toBeNull();
    expect(tracker.getMaxAltitude()).toBeNull();
  });
});
