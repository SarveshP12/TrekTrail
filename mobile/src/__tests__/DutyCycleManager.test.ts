import { DutyCycleManager } from '../services/location/DutyCycleManager';
import { GPSReading } from '../services/location/LocationProvider';

// Mock the locationProvider to capture setInterval calls
jest.mock('../services/location/LocationProvider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('node:events');

  class MockLocationProvider extends EventEmitter {
    private intervalMs = 1000;
    private subscription: any = null;

    async requestPermissions() { return true; }
    async checkPermissions() { return { foreground: true, background: true }; }
    async startWatching(ms = 1000) { this.intervalMs = ms; }
    stopWatching() {}
    async setInterval(ms: number) { this.intervalMs = ms; }
    getInterval() { return this.intervalMs; }
    isWatching() { return !!this.subscription; }
  }

  return {
    locationProvider: new MockLocationProvider(),
    GPSReading: {},
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { locationProvider } = require('../services/location/LocationProvider');

function makeReading(speed: number | null): GPSReading {
  return {
    latitude: 0,
    longitude: 0,
    altitude: null,
    accuracy: 5,
    speed,
    heading: null,
    timestamp: Date.now(),
  };
}

describe('DutyCycleManager', () => {
  let manager: DutyCycleManager;

  beforeEach(() => {
    manager = new DutyCycleManager();
  });

  it('should start in stationary state', () => {
    expect(manager.getState()).toBe('stationary');
  });

  it('should transition to walking when speed is between thresholds', () => {
    // Speed > 0.3 m/s (stationary threshold) and < 3.0 m/s (fast threshold)
    manager.onReading(makeReading(1.5));
    expect(manager.getState()).toBe('walking');
  });

  it('should transition to moving_fast when speed exceeds fast threshold', () => {
    manager.onReading(makeReading(5.0)); // > 3.0 m/s
    expect(manager.getState()).toBe('moving_fast');
  });

  it('should not go stationary until 10+ consecutive slow readings', () => {
    // First go to walking
    manager.onReading(makeReading(2.0));
    expect(manager.getState()).toBe('walking');

    // Send 9 slow readings — should stay in walking
    for (let i = 0; i < 9; i++) {
      manager.onReading(makeReading(0.1));
    }
    expect(manager.getState()).toBe('walking');

    // 10th slow reading still walking (threshold is > 10)
    manager.onReading(makeReading(0.1));
    expect(manager.getState()).toBe('walking');

    // 11th triggers stationary
    manager.onReading(makeReading(0.1));
    expect(manager.getState()).toBe('stationary');
  });

  it('should reset stationary count on fast movement', () => {
    // Go to walking
    manager.onReading(makeReading(2.0));

    // A few slow readings
    for (let i = 0; i < 5; i++) {
      manager.onReading(makeReading(0.1));
    }

    // Fast movement resets counter
    manager.onReading(makeReading(5.0));
    expect(manager.getState()).toBe('moving_fast');

    // 5 slow readings again — shouldn't be enough after reset
    for (let i = 0; i < 5; i++) {
      manager.onReading(makeReading(0.1));
    }
    expect(manager.getState()).not.toBe('stationary');
  });

  it('should treat null speed as 0 (stationary)', () => {
    manager.onReading(makeReading(2.0)); // walking
    for (let i = 0; i < 12; i++) {
      manager.onReading(makeReading(null));
    }
    expect(manager.getState()).toBe('stationary');
  });

  it('should adjust GPS interval based on state', async () => {
    // Walking → 1000ms
    manager.onReading(makeReading(2.0));
    expect(await locationProvider.getInterval()).toBe(1000);

    // Fast → 500ms
    manager.onReading(makeReading(5.0));
    expect(await locationProvider.getInterval()).toBe(500);
  });

  it('should reset correctly', () => {
    manager.onReading(makeReading(5.0));
    expect(manager.getState()).toBe('moving_fast');

    manager.reset();
    expect(manager.getState()).toBe('stationary');
  });
});
