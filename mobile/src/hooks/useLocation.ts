import { useState, useEffect, useCallback } from 'react';
import { locationProvider, GPSReading } from '../services/location/LocationProvider';

/**
 * Hook to subscribe to real-time GPS location updates.
 * Returns the latest reading and connection state.
 */
export function useLocation() {
  const [location, setLocation] = useState<GPSReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleLocation = (reading: GPSReading) => {
      setLocation(reading);
      setError(null);
    };

    const handleError = (err: any) => {
      setError(err.message || 'Location error');
    };

    locationProvider.on('location', handleLocation);
    locationProvider.on('error', handleError);

    setIsActive(locationProvider.isWatching());

    return () => {
      locationProvider.removeListener('location', handleLocation);
      locationProvider.removeListener('error', handleError);
    };
  }, []);

  const startTracking = useCallback(async (intervalMs = 1000) => {
    await locationProvider.startWatching(intervalMs);
    setIsActive(true);
  }, []);

  const stopTracking = useCallback(() => {
    locationProvider.stopWatching();
    setIsActive(false);
  }, []);

  return {
    location,
    error,
    isActive,
    startTracking,
    stopTracking,
  };
}
