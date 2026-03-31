// Mock for expo-location
export const Accuracy = {
  BestForNavigation: 6,
  Highest: 5,
  High: 4,
  Balanced: 3,
  Low: 2,
  Lowest: 1,
};

export async function requestForegroundPermissionsAsync() {
  return { status: 'granted' };
}

export async function requestBackgroundPermissionsAsync() {
  return { status: 'granted' };
}

export async function getForegroundPermissionsAsync() {
  return { status: 'granted' };
}

export async function getBackgroundPermissionsAsync() {
  return { status: 'granted' };
}

export async function watchPositionAsync() {
  return { remove: () => {} };
}

export async function hasStartedLocationUpdatesAsync() {
  return false;
}

export async function startLocationUpdatesAsync() {}
export async function stopLocationUpdatesAsync() {}
