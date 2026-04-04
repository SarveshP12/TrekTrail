import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { gpsRepo } from '../db/gps-repository';

const BACKGROUND_LOCATION_TASK = 'TREKTRACK_BACKGROUND_LOCATION';

export interface BackgroundLocationCallback {
  (locations: Location.LocationObject[]): void;
}

let _backgroundCallback: BackgroundLocationCallback | null = null;

// Define the background task globally — this runs even if the app is killed
// Wrapped in try-catch to prevent crashing app registration if TaskManager
// isn't fully initialized (e.g., in Expo Go or on first launch)
try {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('[BackgroundTracker] Error:', error.message);
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      
      // 1. Persist to DB if active session exists
      try {
        const activeSessionId = await gpsRepo.getActiveSession();
        if (activeSessionId) {
          for (const loc of locations) {
            await gpsRepo.addPoint(activeSessionId, {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              altitude: loc.coords.altitude,
              accuracy: loc.coords.accuracy ?? 0,
              speed: loc.coords.speed,
              timestamp: loc.timestamp,
              heading: loc.coords.heading
            });
          }
        }
      } catch (e) {
        console.error('[BackgroundTracker] DB Write Error:', e);
      }

      // 2. Notify UI if alive
      if (_backgroundCallback) {
        _backgroundCallback(locations);
      }
    }
  });
} catch (e) {
  console.warn('[BackgroundTracker] Failed to define background task (expected in Expo Go):', e);
}


export class BackgroundTracker {
  /**
   * Start background location tracking.
   * Requires background location permission.
   */
  static async start(
    callback: BackgroundLocationCallback,
    options?: {
      timeInterval?: number;
      distanceInterval?: number;
    },
  ): Promise<boolean> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log(
        '[BackgroundTracker] Background location permission not granted, falling back to foreground location.',
      );
      return false;
    }

    _backgroundCallback = callback;

    const isStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: options?.timeInterval ?? 1000,
      distanceInterval: options?.distanceInterval ?? 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'TrekTrack GPS Active',
        notificationBody: 'Recording your trek in the background',
        notificationColor: '#10B981',
      },
    });

    return true;
  }

  /**
   * Stop background location tracking.
   */
  static async stop(): Promise<void> {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    _backgroundCallback = null;
  }

  /**
   * Check if background tracking is currently active.
   */
  static async isActive(): Promise<boolean> {
    return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export { BACKGROUND_LOCATION_TASK };
