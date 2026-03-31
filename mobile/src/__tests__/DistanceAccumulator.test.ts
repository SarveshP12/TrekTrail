import {
  DistanceAccumulator,
  haversine2D,
  distance3D,
} from '../services/tracking/DistanceAccumulator';
import { GPSReading } from '../services/location/LocationProvider';

function makeReading(
  lat: number,
  lon: number,
  alt: number | null = null,
  accuracy: number = 5,
  timestamp: number = Date.now(),
): GPSReading {
  return {
    latitude: lat,
    longitude: lon,
    altitude: alt,
    accuracy,
    speed: null,
    heading: null,
    timestamp,
  };
}

describe('haversine2D', () => {
  it('should return ~111,195 m for 1 degree of latitude at equator', () => {
    const dist = haversine2D(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it('should return 0 for the same point', () => {
    const dist = haversine2D(40.7128, -74.006, 40.7128, -74.006);
    expect(dist).toBeCloseTo(0, 5);
  });

  it('should compute a known distance (NYC to LA ~3944 km)', () => {
    const dist = haversine2D(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist / 1000).toBeGreaterThan(3900);
    expect(dist / 1000).toBeLessThan(4000);
  });

  it('should handle antipodal points (~20,000 km)', () => {
    const dist = haversine2D(0, 0, 0, 180);
    expect(dist / 1000).toBeGreaterThan(19900);
    expect(dist / 1000).toBeLessThan(20100);
  });
});

describe('distance3D', () => {
  it('should return ~100 m for pure altitude change', () => {
    const dist = distance3D(0, 0, 0, 0, 0, 100);
    expect(dist).toBeCloseTo(100, 0);
  });

  it('should be greater than 2D distance when altitude differs', () => {
    const d2d = haversine2D(0, 0, 0, 0.001);
    const d3d = distance3D(0, 0, 0, 0, 0.001, 500);
    expect(d3d).toBeGreaterThan(d2d);
  });

  it('should equal 2D distance when altitude is the same', () => {
    const d2d = haversine2D(10, 20, 10.01, 20.01);
    const d3d = distance3D(10, 20, 100, 10.01, 20.01, 100);
    expect(d3d).toBeCloseTo(d2d, 2);
  });
});

describe('DistanceAccumulator', () => {
  let acc: DistanceAccumulator;

  beforeEach(() => {
    acc = new DistanceAccumulator();
  });

  it('should start with 0 distance', () => {
    expect(acc.getDistance2D()).toBe(0);
    expect(acc.getDistance3D()).toBe(0);
  });

  it('should accumulate distance from sequential readings', () => {
    acc.addReading(makeReading(0, 0, 100));
    acc.addReading(makeReading(0, 0.001, 100)); // ~111m east

    expect(acc.getDistance2D()).toBeGreaterThan(50);
    expect(acc.getDistance3D()).toBeGreaterThan(50);
  });

  it('should accumulate 3D distance > 2D distance when altitude changes', () => {
    acc.addReading(makeReading(0, 0, 0));
    acc.addReading(makeReading(0, 0.001, 100));

    expect(acc.getDistance3D()).toBeGreaterThan(acc.getDistance2D());
  });

  it('should ignore tiny movements (GPS jitter) with low accuracy', () => {
    acc.addReading(makeReading(0, 0, 100, 50)); // accuracy = 50m (poor)
    acc.addReading(makeReading(0, 0.0000001, 100, 50)); // ~0.01m movement

    // With poor accuracy AND tiny distance, it should be filtered
    expect(acc.getDistance2D()).toBe(0);
  });

  it('should reset correctly', () => {
    acc.addReading(makeReading(0, 0, 0));
    acc.addReading(makeReading(1, 1, 1000));

    acc.reset();

    expect(acc.getDistance2D()).toBe(0);
    expect(acc.getDistance3D()).toBe(0);
  });
});
