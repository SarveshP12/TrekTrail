import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

export type PermissionLevel = 'none' | 'foreground' | 'background';

/**
 * Hook for managing location permissions with user-friendly prompts.
 * Handles the multi-step permission request flow for both iOS and Android.
 */
export function usePermissions() {
  const [level, setLevel] = useState<PermissionLevel>('none');
  const [isChecking, setIsChecking] = useState(true);

  const checkPermissions = useCallback(async () => {
    setIsChecking(true);
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();

      if (bg.status === 'granted') {
        setLevel('background');
      } else if (fg.status === 'granted') {
        setLevel('foreground');
      } else {
        setLevel('none');
      }
    } catch {
      setLevel('none');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  /** Request foreground location permission. */
  const requestForeground = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLevel((prev) => (prev === 'none' ? 'foreground' : prev));
      return true;
    }

    Alert.alert(
      'Location Permission Required',
      'TrekTrack needs access to your location to record treks. Please enable location access in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }, []);

  /** Request background location permission (must have foreground first). */
  const requestBackground = useCallback(async (): Promise<boolean> => {
    // First ensure foreground is granted
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const granted = await requestForeground();
      if (!granted) return false;
    }

    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status === 'granted') {
      setLevel('background');
      return true;
    }

    Alert.alert(
      'Background Location',
      'For best tracking accuracy while hiking, enable "Always" location access in Settings.',
      [
        { text: 'Skip', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }, [requestForeground]);

  /** Request both foreground and background in sequence. */
  const requestAll = useCallback(async (): Promise<PermissionLevel> => {
    const fgGranted = await requestForeground();
    if (!fgGranted) return 'none';

    const bgGranted = await requestBackground();
    return bgGranted ? 'background' : 'foreground';
  }, [requestForeground, requestBackground]);

  return {
    level,
    isChecking,
    requestForeground,
    requestBackground,
    requestAll,
    refresh: checkPermissions,
  };
}
