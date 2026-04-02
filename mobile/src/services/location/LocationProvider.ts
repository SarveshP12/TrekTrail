import * as Location from 'expo-location';
import EventEmitter from 'eventemitter3';

export interface GPSReading {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number; // ms since epoch
}

class LocationProvider extends EventEmitter {
  private subscription: Location.LocationSubscription | null = null;
  private intervalMs: number = 1000; // 1 Hz default

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    await Location.requestBackgroundPermissionsAsync();
    // Background is optional — foreground is enough for core tracking
    return foregroundStatus === 'granted';
  }

  async checkPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return {
      foreground: fg.status === 'granted',
      background: bg.status === 'granted',
    };
  }

  async startWatching(intervalMs: number = 1000): Promise<void> {
    this.intervalMs = intervalMs;

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: this.intervalMs,
        distanceInterval: 0,
      },
      (location: Location.LocationObject) => {
        const reading: GPSReading = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy ?? 999,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: location.timestamp,
        };
        this.emit('location', reading);
      },
    );
  }

  stopWatching(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  async setInterval(ms: number): Promise<void> {
    if (this.subscription) {
      this.stopWatching();
      await this.startWatching(ms);
    }
    this.intervalMs = ms;
  }

  getInterval(): number {
    return this.intervalMs;
  }

  isWatching(): boolean {
    return this.subscription !== null;
  }
}

export const locationProvider = new LocationProvider();
