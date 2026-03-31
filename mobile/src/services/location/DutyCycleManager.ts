import { GPSReading } from './LocationProvider';
import { locationProvider } from './LocationProvider';

export type MotionState = 'stationary' | 'walking' | 'moving_fast';

/**
 * Battery-optimized GPS duty cycling.
 * Adjusts GPS polling frequency based on detected motion state:
 * - stationary: 0.2 Hz (5000ms) — save battery
 * - walking: 1 Hz (1000ms) — normal trekking
 * - moving_fast: 2 Hz (500ms) — trail running / fast hiking
 */
export class DutyCycleManager {
  private state: MotionState = 'stationary';
  private stationaryCount = 0;

  private readonly STATIONARY_THRESHOLD = 0.3; // m/s (~1 km/h)
  private readonly FAST_THRESHOLD = 3.0; // m/s (~11 km/h)
  private readonly STATIONARY_COUNT_BEFORE_SWITCH = 10; // consecutive readings

  onReading(reading: GPSReading): void {
    const speed = reading.speed ?? 0;

    let newState: MotionState;
    if (speed < this.STATIONARY_THRESHOLD) {
      this.stationaryCount++;
      newState =
        this.stationaryCount > this.STATIONARY_COUNT_BEFORE_SWITCH
          ? 'stationary'
          : this.state;
    } else if (speed > this.FAST_THRESHOLD) {
      this.stationaryCount = 0;
      newState = 'moving_fast';
    } else {
      this.stationaryCount = 0;
      newState = 'walking';
    }

    if (newState !== this.state) {
      this.state = newState;
      this.applyInterval();
    }
  }

  private applyInterval(): void {
    switch (this.state) {
      case 'stationary':
        locationProvider.setInterval(5000); // 0.2 Hz — save battery
        break;
      case 'walking':
        locationProvider.setInterval(1000); // 1 Hz
        break;
      case 'moving_fast':
        locationProvider.setInterval(500); // 2 Hz
        break;
    }
  }

  getState(): MotionState {
    return this.state;
  }

  reset(): void {
    this.state = 'stationary';
    this.stationaryCount = 0;
  }
}
