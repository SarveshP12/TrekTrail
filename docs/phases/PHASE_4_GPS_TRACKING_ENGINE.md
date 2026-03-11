# Phase 4: Mobile GPS Tracking Engine

## Phase Title

**Mobile GPS Tracking Engine — On-Device GPS Recording, 3D Distance, and Background Tracking**

---

## Objective

Build the core mobile GPS tracking engine that records high-frequency GPS data, runs background tracking, computes real-time distance and elevation, manages a local ring buffer for offline storage, and syncs recorded points to the backend when connectivity is available. After this phase, the mobile app can record a full trek with continuous GPS, display live stats, and reliably persist data on-device.

---

## Features Implemented in This Phase

- High-frequency GPS location provider (1 Hz configurable)
- Background location tracking (Android foreground service, iOS background modes)
- Local GPS ring buffer with SQLite/WatermelonDB persistence
- Real-time 2D and 3D distance accumulation
- Elevation tracking (gain / loss / current altitude)
- Speed computation (instantaneous + moving average)
- Battery-efficient GPS duty cycling: full power during motion, low power when idle
- Network-aware batch upload of GPS points to backend
- Location permission handling flow (Android 14 + iOS 17)

---

## Tasks Breakdown

* Task 1: Configure React Native location permissions (Android Manifest, Info.plist)
* Task 2: Integrate `react-native-geolocation-service` or `expo-location` for foreground GPS
* Task 3: Implement background location tracking (headless JS / foreground service)
* Task 4: Create local GPS point storage with WatermelonDB
* Task 5: Build GPS ring buffer manager (max 50 000 points per session, FIFO eviction)
* Task 6: Implement real-time 3D distance accumulation module
* Task 7: Implement speed calculation (instantaneous + 30-second moving average)
* Task 8: Implement battery-optimized duty cycling (motion detection → adjust GPS interval)
* Task 9: Build network-aware batch sync service (upload pending points when online)
* Task 10: Create the `TrekRecorder` context/provider that ties everything together
* Task 11: Build the active trek HUD overlay (live stats: distance, speed, elevation, duration)
* Task 12: Handle location permission prompts and denial gracefully
* Task 13: Write unit tests for distance, speed, and buffer modules

---

## File Structure for This Phase

```
mobile/
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml           # Updated: location permissions, foreground service
│       └── java/.../LocationForegroundService.java  # Android foreground service
├── ios/
│   ├── Info.plist                        # Updated: NSLocation*UsageDescription keys
│   └── TrekTrail/
│       └── LocationModule.swift          # iOS background location bridge (optional)
├── src/
│   ├── services/
│   │   ├── location/
│   │   │   ├── index.ts                  # Re-export barrel
│   │   │   ├── LocationProvider.ts       # Wraps native GPS APIs, emits events
│   │   │   ├── BackgroundTracker.ts      # Headless task / foreground service manager
│   │   │   ├── RingBuffer.ts             # In-memory ring buffer (configurable capacity)
│   │   │   └── DutyCycleManager.ts       # Adjusts GPS interval based on motion state
│   │   ├── tracking/
│   │   │   ├── index.ts
│   │   │   ├── DistanceAccumulator.ts    # 3D Haversine incremental distance
│   │   │   ├── ElevationTracker.ts       # Gain/loss from altitude stream
│   │   │   ├── SpeedCalculator.ts        # Instantaneous + moving average speed
│   │   │   └── TrekStatsEngine.ts        # Aggregates all real-time stats
│   │   ├── sync/
│   │   │   ├── index.ts
│   │   │   ├── BatchUploader.ts          # Queue + network-aware POST to backend
│   │   │   └── ConnectivityMonitor.ts    # NetInfo wrapper, emits online/offline
│   │   └── db/
│   │       ├── index.ts
│   │       ├── schema.ts                 # WatermelonDB schema (gps_points, sessions)
│   │       ├── models/
│   │       │   ├── GPSPoint.ts           # WatermelonDB Model
│   │       │   └── LocalSession.ts       # WatermelonDB Model
│   │       └── database.ts              # WatermelonDB initialization
│   ├── context/
│   │   └── TrekRecorderContext.tsx        # React Context: start/stop/pause, live stats
│   ├── hooks/
│   │   ├── useLocation.ts                # Subscribe to LocationProvider events
│   │   ├── useTrekRecorder.ts            # Consume TrekRecorderContext
│   │   └── usePermissions.ts             # Location permission request hook
│   ├── components/
│   │   ├── TrekHUD.tsx                   # Live overlay: distance, speed, elevation, time
│   │   └── PermissionGate.tsx            # Blocks children until permissions granted
│   └── __tests__/
│       ├── DistanceAccumulator.test.ts
│       ├── SpeedCalculator.test.ts
│       ├── RingBuffer.test.ts
│       └── ElevationTracker.test.ts
```

---

## Implementation Guide

### Task 1 — Location Permissions

**Android** — `android/app/src/main/AndroidManifest.xml` additions:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

<application ...>
  <service
    android:name=".LocationForegroundService"
    android:foregroundServiceType="location"
    android:exported="false" />
</application>
```

**iOS** — `ios/Info.plist` additions:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>TrekTrack needs your location to record your trek route and calculate distance.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>TrekTrack needs background location to keep tracking while the app is minimised.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
</array>
```

### Task 2 — Location Provider

```bash
npm install react-native-geolocation-service @react-native-community/netinfo
npm install @nozbe/watermelondb @nozbe/with-observables
```

`mobile/src/services/location/LocationProvider.ts`:

```typescript
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import { EventEmitter } from 'events';

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
  private watchId: number | null = null;
  private intervalMs: number = 1000; // 1 Hz default

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const fineGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'TrekTrack needs GPS access to record your trek.',
          buttonPositive: 'Allow',
        },
      );
      return fineGranted === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS permissions are handled by Geolocation.requestAuthorization
    return new Promise((resolve) => {
      Geolocation.requestAuthorization('always');
      // iOS will show the prompt; we assume success and verify later
      resolve(true);
    });
  }

  startWatching(intervalMs: number = 1000): void {
    this.intervalMs = intervalMs;
    this.watchId = Geolocation.watchPosition(
      (position: GeoPosition) => {
        const reading: GPSReading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        };
        this.emit('location', reading);
      },
      (error) => this.emit('error', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: this.intervalMs,
        fastestInterval: this.intervalMs,
        showsBackgroundLocationIndicator: true,
      },
    );
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  setInterval(ms: number): void {
    if (this.watchId !== null) {
      this.stopWatching();
      this.startWatching(ms);
    }
    this.intervalMs = ms;
  }
}

export const locationProvider = new LocationProvider();
```

### Task 5 — Ring Buffer

`mobile/src/services/location/RingBuffer.ts`:

```typescript
import { GPSReading } from './LocationProvider';

export class RingBuffer {
  private buffer: GPSReading[];
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 50000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(reading: GPSReading): void {
    this.buffer[this.head] = reading;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): GPSReading[] {
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count);
    }
    // Wrap-around: tail is at head
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }

  getLatest(n: number): GPSReading[] {
    const all = this.getAll();
    return all.slice(Math.max(0, all.length - n));
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
```

### Task 6 — 3D Distance Accumulator

`mobile/src/services/tracking/DistanceAccumulator.ts`:

```typescript
import { GPSReading } from '../location/LocationProvider';

const EARTH_RADIUS = 6371000; // meters
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversine2D(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distance3D(
  lat1: number, lon1: number, alt1: number,
  lat2: number, lon2: number, alt2: number,
): number {
  const horiz = haversine2D(lat1, lon1, lat2, lon2);
  const vert = alt2 - alt1;
  return Math.sqrt(horiz ** 2 + vert ** 2);
}

export class DistanceAccumulator {
  private totalDistance2D = 0;
  private totalDistance3D = 0;
  private lastReading: GPSReading | null = null;

  addReading(reading: GPSReading): void {
    if (this.lastReading) {
      const d2d = haversine2D(
        this.lastReading.latitude, this.lastReading.longitude,
        reading.latitude, reading.longitude,
      );

      const alt1 = this.lastReading.altitude ?? 0;
      const alt2 = reading.altitude ?? 0;
      const d3d = distance3D(
        this.lastReading.latitude, this.lastReading.longitude, alt1,
        reading.latitude, reading.longitude, alt2,
      );

      // Ignore GPS jitter: skip segments < 2 m with low accuracy
      if (d2d >= 2 || reading.accuracy < 10) {
        this.totalDistance2D += d2d;
        this.totalDistance3D += d3d;
      }
    }
    this.lastReading = reading;
  }

  getDistance2D(): number {
    return this.totalDistance2D;
  }

  getDistance3D(): number {
    return this.totalDistance3D;
  }

  reset(): void {
    this.totalDistance2D = 0;
    this.totalDistance3D = 0;
    this.lastReading = null;
  }
}
```

### Task 7 — Speed Calculator

`mobile/src/services/tracking/SpeedCalculator.ts`:

```typescript
import { GPSReading } from '../location/LocationProvider';
import { haversine2D } from './DistanceAccumulator';

export class SpeedCalculator {
  private windowMs: number;
  private readings: GPSReading[] = [];

  constructor(windowMs: number = 30000) {
    this.windowMs = windowMs;
  }

  addReading(reading: GPSReading): void {
    this.readings.push(reading);
    // Evict readings outside the moving average window
    const cutoff = reading.timestamp - this.windowMs;
    while (this.readings.length > 1 && this.readings[0].timestamp < cutoff) {
      this.readings.shift();
    }
  }

  /** Instantaneous speed in m/s from the last two readings. */
  getInstantaneousSpeed(): number {
    if (this.readings.length < 2) return 0;
    const a = this.readings[this.readings.length - 2];
    const b = this.readings[this.readings.length - 1];
    const dist = haversine2D(a.latitude, a.longitude, b.latitude, b.longitude);
    const dt = (b.timestamp - a.timestamp) / 1000;
    return dt > 0 ? dist / dt : 0;
  }

  /** Moving average speed in m/s over the configured window. */
  getAverageSpeed(): number {
    if (this.readings.length < 2) return 0;
    let totalDist = 0;
    for (let i = 1; i < this.readings.length; i++) {
      totalDist += haversine2D(
        this.readings[i - 1].latitude, this.readings[i - 1].longitude,
        this.readings[i].latitude, this.readings[i].longitude,
      );
    }
    const totalTime =
      (this.readings[this.readings.length - 1].timestamp - this.readings[0].timestamp) / 1000;
    return totalTime > 0 ? totalDist / totalTime : 0;
  }

  reset(): void {
    this.readings = [];
  }
}
```

### Task 8 — Battery Duty Cycle Manager

`mobile/src/services/location/DutyCycleManager.ts`:

```typescript
import { GPSReading } from './LocationProvider';
import { locationProvider } from './LocationProvider';

type MotionState = 'stationary' | 'walking' | 'moving_fast';

export class DutyCycleManager {
  private state: MotionState = 'stationary';
  private stationaryCount = 0;
  private readonly STATIONARY_THRESHOLD = 0.3; // m/s
  private readonly FAST_THRESHOLD = 3.0; // m/s

  onReading(reading: GPSReading): void {
    const speed = reading.speed ?? 0;

    let newState: MotionState;
    if (speed < this.STATIONARY_THRESHOLD) {
      this.stationaryCount++;
      newState = this.stationaryCount > 10 ? 'stationary' : this.state;
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
        locationProvider.setInterval(500); // 2 Hz for fast hiking / trail running
        break;
    }
  }

  getState(): MotionState {
    return this.state;
  }
}
```

### Task 9 — Batch Uploader

`mobile/src/services/sync/BatchUploader.ts`:

```typescript
import NetInfo from '@react-native-community/netinfo';
import { GPSReading } from '../location/LocationProvider';

const BATCH_SIZE = 100;
const UPLOAD_INTERVAL_MS = 15000; // attempt upload every 15 sec

export class BatchUploader {
  private queue: GPSReading[] = [];
  private sessionId: string | null = null;
  private token: string;
  private baseUrl: string;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  setSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  enqueue(reading: GPSReading): void {
    this.queue.push(reading);
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), UPLOAD_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flush(): Promise<void> {
    if (!this.sessionId || this.queue.length === 0) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    const batch = this.queue.splice(0, BATCH_SIZE);
    const payload = {
      session_id: this.sessionId,
      points: batch.map((r) => ({
        time: new Date(r.timestamp).toISOString(),
        latitude: r.latitude,
        longitude: r.longitude,
        altitude: r.altitude,
        accuracy: r.accuracy,
        speed: r.speed,
      })),
    };

    try {
      const resp = await fetch(`${this.baseUrl}/sessions/${this.sessionId}/points`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        // Re-add failed batch to front of queue
        this.queue.unshift(...batch);
      }
    } catch {
      this.queue.unshift(...batch);
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}
```

### Task 10 — TrekRecorder Context

`mobile/src/context/TrekRecorderContext.tsx`:

```tsx
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { locationProvider, GPSReading } from '../services/location/LocationProvider';
import { RingBuffer } from '../services/location/RingBuffer';
import { DistanceAccumulator } from '../services/tracking/DistanceAccumulator';
import { SpeedCalculator } from '../services/tracking/SpeedCalculator';
import { DutyCycleManager } from '../services/location/DutyCycleManager';
import { BatchUploader } from '../services/sync/BatchUploader';

export interface TrekStats {
  distance2D: number;
  distance3D: number;
  speed: number;
  avgSpeed: number;
  altitude: number | null;
  elevationGain: number;
  elevationLoss: number;
  durationMs: number;
  pointCount: number;
}

interface TrekRecorderContextType {
  isRecording: boolean;
  stats: TrekStats;
  start: (activityType: string) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

const TrekRecorderContext = createContext<TrekRecorderContextType | null>(null);

export function TrekRecorderProvider({ children, apiBaseUrl, token }: {
  children: React.ReactNode;
  apiBaseUrl: string;
  token: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [stats, setStats] = useState<TrekStats>(emptyStats());

  const buffer = useRef(new RingBuffer(50000));
  const distAcc = useRef(new DistanceAccumulator());
  const speedCalc = useRef(new SpeedCalculator(30000));
  const dutyCycle = useRef(new DutyCycleManager());
  const uploader = useRef(new BatchUploader(apiBaseUrl, token));
  const startTime = useRef<number>(0);
  const elevGain = useRef(0);
  const elevLoss = useRef(0);
  const prevAlt = useRef<number | null>(null);

  const handleReading = useCallback((reading: GPSReading) => {
    buffer.current.push(reading);
    distAcc.current.addReading(reading);
    speedCalc.current.addReading(reading);
    dutyCycle.current.onReading(reading);
    uploader.current.enqueue(reading);

    // Elevation tracking
    if (reading.altitude !== null && prevAlt.current !== null) {
      const delta = reading.altitude - prevAlt.current;
      if (delta > 0) elevGain.current += delta;
      else elevLoss.current += Math.abs(delta);
    }
    if (reading.altitude !== null) prevAlt.current = reading.altitude;

    setStats({
      distance2D: distAcc.current.getDistance2D(),
      distance3D: distAcc.current.getDistance3D(),
      speed: speedCalc.current.getInstantaneousSpeed(),
      avgSpeed: speedCalc.current.getAverageSpeed(),
      altitude: reading.altitude,
      elevationGain: elevGain.current,
      elevationLoss: elevLoss.current,
      durationMs: Date.now() - startTime.current,
      pointCount: buffer.current.size,
    });
  }, []);

  const start = useCallback(async (activityType: string) => {
    // Reset state
    buffer.current.clear();
    distAcc.current.reset();
    speedCalc.current.reset();
    elevGain.current = 0;
    elevLoss.current = 0;
    prevAlt.current = null;
    startTime.current = Date.now();

    // Create session on backend
    const resp = await fetch(`${apiBaseUrl}/sessions/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_type: activityType }),
    });
    const session = await resp.json();
    uploader.current.setSession(session.id);

    locationProvider.on('location', handleReading);
    locationProvider.startWatching(1000);
    uploader.current.start();
    setIsRecording(true);
  }, [apiBaseUrl, token, handleReading]);

  const stop = useCallback(async () => {
    locationProvider.stopWatching();
    locationProvider.removeListener('location', handleReading);
    await uploader.current.flush(); // send remaining
    uploader.current.stop();
    setIsRecording(false);
  }, [handleReading]);

  const pause = useCallback(() => {
    locationProvider.stopWatching();
  }, []);

  const resume = useCallback(() => {
    locationProvider.startWatching(1000);
  }, []);

  return (
    <TrekRecorderContext.Provider value={{ isRecording, stats, start, stop, pause, resume }}>
      {children}
    </TrekRecorderContext.Provider>
  );
}

export function useTrekRecorder() {
  const ctx = useContext(TrekRecorderContext);
  if (!ctx) throw new Error('useTrekRecorder must be inside TrekRecorderProvider');
  return ctx;
}

function emptyStats(): TrekStats {
  return {
    distance2D: 0, distance3D: 0, speed: 0, avgSpeed: 0,
    altitude: null, elevationGain: 0, elevationLoss: 0,
    durationMs: 0, pointCount: 0,
  };
}
```

### Task 11 — Trek HUD Component

`mobile/src/components/TrekHUD.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTrekRecorder } from '../context/TrekRecorderContext';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function TrekHUD() {
  const { stats } = useTrekRecorder();

  return (
    <View style={styles.container}>
      <StatItem label="Distance" value={`${(stats.distance3D / 1000).toFixed(2)} km`} />
      <StatItem label="Speed" value={`${(stats.speed * 3.6).toFixed(1)} km/h`} />
      <StatItem label="Elevation ↑" value={`${stats.elevationGain.toFixed(0)} m`} />
      <StatItem label="Altitude" value={stats.altitude ? `${stats.altitude.toFixed(0)} m` : '--'} />
      <StatItem label="Duration" value={formatDuration(stats.durationMs)} />
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12 },
  statItem: { width: '50%', padding: 8 },
  label: { color: '#aaa', fontSize: 12 },
  value: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
```

---

## Dependencies

```json
{
  "react-native-geolocation-service": "^5.3.1",
  "@react-native-community/netinfo": "^11.3.0",
  "@nozbe/watermelondb": "^0.27.1",
  "@nozbe/with-observables": "^1.6.0"
}
```

---

## Expected Output

After completing this phase:

1. The mobile app requests and handles location permissions on both platforms.
2. Pressing "Start Trek" begins 1 Hz GPS recording that continues in the background.
3. Live stats (distance, speed, elevation, duration) are computed on-device and displayed in the HUD overlay.
4. GPS points are buffered locally in a 50 000-point ring buffer and persisted to WatermelonDB.
5. Batches of 100 points are synced to the backend every 15 seconds when the device has connectivity.
6. GPS polling frequency automatically adjusts based on motion state to conserve battery.

---

## Testing Instructions

### 1. Unit Tests

```bash
cd mobile
npx jest --testPathPattern='__tests__/(DistanceAccumulator|SpeedCalculator|RingBuffer|ElevationTracker)'
```

Verify:
- `haversine2D(0, 0, 0, 1)` ≈ 111 195 m
- `distance3D(0, 0, 0, 0, 0, 100)` ≈ 100 m (same lat/lon, altitude change)
- Ring buffer wraps correctly at capacity
- Speed calculator returns 0 with fewer than 2 readings

### 2. On-Device Integration (Emulator)

- Launch app on Android emulator with mock location enabled
- Start a trek session, pipe mock GPX route via `adb emu geo fix`
- Verify live stats update in HUD
- Kill app → reopen → confirm background tracking persisted data

### 3. Network Sync Test

- Enable airplane mode → record 2 minutes of trek
- Disable airplane mode → confirm points appear in backend
  ```bash
  curl http://localhost:8000/sessions/<ID>/track -H "Authorization: Bearer <TOKEN>"
  ```
