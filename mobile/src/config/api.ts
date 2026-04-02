// import { Platform } from 'react-native';

/**
 * API URL configuration that works across platforms:
 * - Android Emulator: 10.0.2.2 (special address for localhost)
 * - iOS Simulator: localhost
 * - Physical devices: Set API_URL_PHYSICAL_DEVICE below
 */

// For physical devices, set this to your machine's IP address
// Example: "http://192.168.1.100:8000"
const API_URL_PHYSICAL_DEVICE = "http://192.168.29.18:8000"; // Changed to actual machine IP

const getAPIUrl = (): string => {
  return API_URL_PHYSICAL_DEVICE; // Always use the machine IP for physical device over Expo Go
};

export const API_URL = getAPIUrl();

export const API_ENDPOINTS = {
  REGISTER: `${API_URL}/auth/register`,
  LOGIN: `${API_URL}/auth/login`,
  SESSIONS: `${API_URL}/sessions`,
  GPS_POINTS: (sessionId: string) => `${API_URL}/sessions/${sessionId}/points`,
};
