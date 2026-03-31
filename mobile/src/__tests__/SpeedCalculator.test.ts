import { SpeedCalculator } from '../services/tracking/SpeedCalculator';
import { GPSReading } from '../services/location/LocationProvider';

function makeReading(
  lat: number,
  lon: number,
  timestamp: number,
  speed: number | null = null,
): GPSReading {
  return {
    latitude: lat,
    longitude: lon,
    altitude: null,
    accuracy: 5,
    speed,
    heading: null,
    timestamp,
  };
}

describe('SpeedCalculator', () => {
  let calc: SpeedCalculator;

  beforeEach(() => {
    calc = new SpeedCalculator(30000); // 30-second window
  });

  it('should return 0 speed with no readings', () => {
    expect(calc.getInstantaneousSpeed()).toBe(0);
    expect(calc.getAverageSpeed()).toBe(0);
  });

  it('should return 0 speed with only one reading', () => {
    calc.addReading(makeReading(0, 0, 1000));
    expect(calc.getInstantaneousSpeed()).toBe(0);
    expect(calc.getAverageSpeed()).toBe(0);
  });

  it('should calculate speed from two readings', () => {
    // ~111m apart, 10 seconds → ~11.1 m/s
    calc.addReading(makeReading(0, 0, 0));
    calc.addReading(makeReading(0, 0.001, 10000));

    const speed = calc.getInstantaneousSpeed();
    expect(speed).toBeGreaterThan(5);
    expect(speed).toBeLessThan(20);
  });

  it('should compute average speed over multiple readings', () => {
    // Move at roughly constant speed
    const pointsCount = 10;
    for (let i = 0; i < pointsCount; i++) {
      calc.addReading(makeReading(0, i * 0.001, i * 5000));
    }

    const avgSpeed = calc.getAverageSpeed();
    expect(avgSpeed).toBeGreaterThan(0);
  });

  it('should evict old readings outside the window', () => {
    // Add readings spread over 60 seconds (window is 30s)
    for (let i = 0; i < 60; i++) {
      calc.addReading(makeReading(0, i * 0.0001, i * 1000));
    }

    // Should only keep ~30 readings
    expect(calc.getReadingCount()).toBeLessThanOrEqual(31);
  });

  it('should reset cleanly', () => {
    calc.addReading(makeReading(0, 0, 0));
    calc.addReading(makeReading(0, 0.001, 1000));

    calc.reset();

    expect(calc.getInstantaneousSpeed()).toBe(0);
    expect(calc.getAverageSpeed()).toBe(0);
    expect(calc.getReadingCount()).toBe(0);
  });
});
