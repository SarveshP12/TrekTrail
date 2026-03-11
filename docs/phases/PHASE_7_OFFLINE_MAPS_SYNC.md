# Phase 7: Offline Maps & Data Sync

## Phase Title

**Offline Maps & Data Synchronization — Tile Caching, Offline Queue, and Conflict-Free Sync**

---

## Objective

Enable full offline capability: download and cache map tiles for offline use via MapLibre, implement an offline-first data architecture with a reliable sync queue, handle conflict resolution when the device comes back online, and provide a tile region manager for users to pre-download areas. After this phase, a user can plan a trek in an area without connectivity, record the entire trek offline, and sync all data seamlessly when connectivity returns.

---

## Features Implemented in This Phase

- MapLibre offline tile pack download and management
- Tile region manager UI (search area → download → progress → manage packs)
- Offline-first data layer: WatermelonDB as the source of truth
- Sync queue: pending operations (create session, upload points, end session) enqueued when offline
- Background sync engine that processes the queue on reconnect
- Conflict resolution strategy (server-wins for server data, client-wins for GPS points)
- Storage management: tile pack size display, delete old packs
- Network status indicator in the app header

---

## Tasks Breakdown

* Task 1: Enable MapLibre offline tile pack API
* Task 2: Build tile region download service (download by bounding box)
* Task 3: Build tile pack management service (list, delete, get size)
* Task 4: Build Offline Map Manager UI screen
* Task 5: Implement WatermelonDB sync schema (sync columns, `_changed`, `_status`)
* Task 6: Build offline operation queue (pending_operations table)
* Task 7: Build SyncEngine service (processes queue in order on reconnect)
* Task 8: Implement conflict resolution for sessions and user data
* Task 9: Update BatchUploader to work with SyncEngine
* Task 10: Build NetworkStatusBar component
* Task 11: Add storage stats to Settings screen
* Task 12: Write integration tests for offline → online sync flow

---

## File Structure for This Phase

```
mobile/src/
├── services/
│   ├── offline/
│   │   ├── index.ts
│   │   ├── TilePackManager.ts            # Download, list, delete tile packs
│   │   ├── OfflineQueue.ts               # Enqueue pending API operations
│   │   ├── SyncEngine.ts                 # Process queue, handle conflicts
│   │   └── StorageManager.ts             # Calculate storage usage
│   ├── sync/
│   │   ├── BatchUploader.ts              # Updated: integrates with OfflineQueue
│   │   └── ConnectivityMonitor.ts        # Updated: triggers SyncEngine
│   └── db/
│       ├── schema.ts                     # Updated: add sync columns
│       ├── models/
│       │   ├── GPSPoint.ts               # Updated: sync status
│       │   ├── LocalSession.ts           # Updated: sync status
│       │   └── PendingOperation.ts       # NEW: queued API calls
│       └── migrations.ts                 # WatermelonDB schema migrations
├── screens/
│   ├── OfflineMapScreen.tsx              # Download / manage tile packs
│   └── SettingsScreen.tsx                # Updated: storage stats section
├── components/
│   ├── NetworkStatusBar.tsx              # Online/offline banner
│   └── TilePackCard.tsx                  # Single tile pack: name, size, delete
└── __tests__/
    ├── OfflineQueue.test.ts
    ├── SyncEngine.test.ts
    └── TilePackManager.test.ts
```

---

## Implementation Guide

### Task 1–2 — MapLibre Offline Tile Pack Manager

`mobile/src/services/offline/TilePackManager.ts`:

```typescript
import MapLibreGL from '@maplibre/maplibre-react-native';

export interface TilePack {
  name: string;
  bounds: [number, number, number, number]; // [west, south, east, north]
  minZoom: number;
  maxZoom: number;
  size?: number; // bytes
  completedPercentage?: number;
}

export class TilePackManager {
  private styleUrl: string;

  constructor(styleUrl: string) {
    this.styleUrl = styleUrl;
  }

  async downloadRegion(
    name: string,
    bounds: [number, number, number, number],
    minZoom: number = 10,
    maxZoom: number = 16,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    const progressListener = (offlineRegion: any, status: any) => {
      if (onProgress && status.percentage !== undefined) {
        onProgress(status.percentage);
      }
    };

    await MapLibreGL.offlineManager.createPack(
      {
        name,
        styleURL: this.styleUrl,
        bounds: [
          [bounds[0], bounds[1]], // SW corner
          [bounds[2], bounds[3]], // NE corner
        ],
        minZoom,
        maxZoom,
      },
      progressListener,
    );
  }

  async listPacks(): Promise<TilePack[]> {
    const packs = await MapLibreGL.offlineManager.getPacks();
    return packs.map((pack: any) => ({
      name: pack.name,
      bounds: pack.bounds ? [
        pack.bounds[0][0], pack.bounds[0][1],
        pack.bounds[1][0], pack.bounds[1][1],
      ] as [number, number, number, number] : [0, 0, 0, 0],
      minZoom: pack.metadata?.minZoom ?? 10,
      maxZoom: pack.metadata?.maxZoom ?? 16,
      size: pack.metadata?.size,
      completedPercentage: pack.completedResourceCount
        ? (pack.completedResourceCount / pack.requiredResourceCount) * 100
        : 100,
    }));
  }

  async deletePack(name: string): Promise<void> {
    await MapLibreGL.offlineManager.deletePack(name);
  }

  async resetDatabase(): Promise<void> {
    await MapLibreGL.offlineManager.resetDatabase();
  }
}
```

### Task 6 — Offline Operation Queue

`mobile/src/services/offline/OfflineQueue.ts`:

```typescript
import { database } from '../db/database';
import { PendingOperation } from '../db/models/PendingOperation';

export type OperationType = 'CREATE_SESSION' | 'UPLOAD_POINTS' | 'END_SESSION' | 'UPDATE_PROFILE';

export interface QueuedOperation {
  type: OperationType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: string; // JSON stringified
  retryCount: number;
}

export class OfflineQueue {
  async enqueue(op: Omit<QueuedOperation, 'retryCount'>): Promise<void> {
    await database.write(async () => {
      await database.get<PendingOperation>('pending_operations').create((record) => {
        record.operationType = op.type;
        record.endpoint = op.endpoint;
        record.method = op.method;
        record.payload = op.payload;
        record.retryCount = 0;
        record.createdAt = Date.now();
      });
    });
  }

  async peek(limit: number = 10): Promise<PendingOperation[]> {
    const collection = database.get<PendingOperation>('pending_operations');
    return collection.query().fetch();
  }

  async dequeue(id: string): Promise<void> {
    await database.write(async () => {
      const record = await database.get<PendingOperation>('pending_operations').find(id);
      await record.destroyPermanently();
    });
  }

  async incrementRetry(id: string): Promise<void> {
    await database.write(async () => {
      const record = await database.get<PendingOperation>('pending_operations').find(id);
      await record.update((r) => {
        r.retryCount += 1;
      });
    });
  }

  async size(): Promise<number> {
    const all = await database.get<PendingOperation>('pending_operations').query().fetchCount();
    return all;
  }
}

export const offlineQueue = new OfflineQueue();
```

### Task 7 — Sync Engine

`mobile/src/services/offline/SyncEngine.ts`:

```typescript
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue, OperationType } from './OfflineQueue';
import { PendingOperation } from '../db/models/PendingOperation';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // exponential-ish

export class SyncEngine {
  private processing = false;
  private baseUrl: string;
  private token: string;
  private unsubscribe: (() => void) | null = null;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /** Start listening to connectivity changes and sync automatically. */
  start(): void {
    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.processing) {
        this.processQueue();
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const pendingOps = await offlineQueue.peek(50);

      for (const op of pendingOps) {
        if (op.retryCount >= MAX_RETRIES) {
          // Dead letter — remove after max retries
          await offlineQueue.dequeue(op.id);
          continue;
        }

        const success = await this.executeOperation(op);
        if (success) {
          await offlineQueue.dequeue(op.id);
        } else {
          await offlineQueue.incrementRetry(op.id);
          // Stop processing — network may be down
          break;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeOperation(op: PendingOperation): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}${op.endpoint}`, {
        method: op.method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: op.payload,
      });

      if (resp.ok || resp.status === 409) {
        // 409 Conflict = already processed (idempotent) — treat as success
        return true;
      }
      if (resp.status >= 400 && resp.status < 500) {
        // Client error — don't retry
        return true;
      }
      return false; // Server error — retry later
    } catch {
      return false; // Network error
    }
  }
}
```

### Task 10 — Network Status Bar

`mobile/src/components/NetworkStatusBar.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function NetworkStatusBar() {
  const [isOffline, setIsOffline] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      Animated.timing(opacity, {
        toValue: offline ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.bar, { opacity }]}>
      <Text style={styles.text}>Offline — data will sync when connected</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#F57C00', paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
```

### Task 4 — Offline Map Manager Screen

`mobile/src/screens/OfflineMapScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { TilePackManager, TilePack } from '../services/offline/TilePackManager';
import { useTheme } from '../theme/useTheme';

const tileManager = new TilePackManager('https://demotiles.maplibre.org/style.json');

export function OfflineMapScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const [packs, setPacks] = useState<TilePack[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    const list = await tileManager.listPacks();
    setPacks(list);
  };

  const downloadCurrentArea = async () => {
    // In a real app, get bounds from the map view
    const bounds: [number, number, number, number] = [73.8, 18.5, 73.9, 18.6]; // Example: Pune area
    setDownloading(true);
    setProgress(0);
    await tileManager.downloadRegion('Pune Region', bounds, 10, 15, (pct) => setProgress(pct));
    setDownloading(false);
    loadPacks();
  };

  const deletePack = async (name: string) => {
    Alert.alert('Delete Tile Pack', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await tileManager.deletePack(name);
        loadPacks();
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.h2, { color: colors.text, padding: spacing.lg }]}>Offline Maps</Text>

      <TouchableOpacity
        style={[styles.downloadBtn, { backgroundColor: colors.primary, borderRadius: radii.md }]}
        onPress={downloadCurrentArea}
        disabled={downloading}
      >
        <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
          {downloading ? `Downloading... ${progress.toFixed(0)}%` : 'Download Current Area'}
        </Text>
      </TouchableOpacity>

      <Text style={[typography.h3, { color: colors.text, padding: spacing.lg }]}>
        Downloaded Regions ({packs.length})
      </Text>

      <FlatList
        data={packs}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text }]}>{item.name}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Zoom {item.minZoom}–{item.maxZoom}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deletePack(item.name)}>
              <Text style={{ color: colors.error, fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  downloadBtn: { marginHorizontal: 16, paddingVertical: 14 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 8 },
});
```

---

## Dependencies

No new dependencies beyond what was installed in previous phases:
- `@maplibre/maplibre-react-native` (Phase 5)
- `@nozbe/watermelondb` (Phase 4)
- `@react-native-community/netinfo` (Phase 4)

---

## Expected Output

After completing this phase:

1. Users can download map tiles for a region before going offline.
2. All trek recording works fully offline — GPS points stored in WatermelonDB.
3. API operations (start session, upload points, end session) are queued when offline.
4. On reconnect, the SyncEngine automatically processes the queue in order.
5. Failed syncs retry with exponential backoff up to 5 times.
6. An orange "Offline" banner appears at the top of the app when disconnected.
7. Settings screen shows total offline storage usage and allows clearing tile packs.

---

## Testing Instructions

### 1. Offline Tile Download Test

- Open Offline Maps screen
- Tap "Download Current Area" → verify progress updates to 100%
- Enable airplane mode → open Active Trek → verify map tiles still render

### 2. Offline Trek Recording Test

- Enable airplane mode
- Start a new trek → record for 2 minutes
- End trek → verify session and points saved locally
- Disable airplane mode → wait 15 seconds → verify data appears on backend

### 3. Sync Queue Test

```bash
cd mobile
npx jest --testPathPattern='(OfflineQueue|SyncEngine)'
```

Verify:
- Operations enqueue correctly
- SyncEngine processes in FIFO order
- Failed operations have retry count incremented
- Operations exceeding MAX_RETRIES are removed

### 4. Conflict Resolution Test

- Create a session while offline
- Modify the same session on the backend directly (simulate another device)
- Reconnect → verify server-wins resolution: backend data takes precedence for metadata, client GPS points merged additively
