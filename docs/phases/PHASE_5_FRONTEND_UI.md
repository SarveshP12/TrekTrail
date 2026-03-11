# Phase 5: Frontend UI & Screens

## Phase Title

**Frontend UI & User Interaction — Navigation, Screens, Map Integration, and Theme System**

---

## Objective

Build the complete React Native UI layer: navigation stack, all major screens (Home Dashboard, Active Trek Map, Trek Summary, History, Profile, Settings), map integration with MapLibre GL, the design system / theme, and reusable component library. After this phase, a user can navigate through every screen, start/stop a trek with live map rendering, review summaries, and browse history.

---

## Features Implemented in This Phase

- Bottom-tab + stack navigation (React Navigation 6)
- Home Dashboard with stats overview and recent treks
- Active Trek screen with full-screen MapLibre map and live polyline
- Trek Summary screen with stats cards, elevation profile chart, and route preview
- Trek History screen with search, filters, and infinite scroll
- User Profile screen with avatar, lifetime stats, and edit mode
- Settings screen (units, GPS interval, theme, notifications)
- MapLibre GL Native integration with user location marker
- Reusable component library: Button, Card, StatCard, Badge, Avatar, Modal
- Light / Dark theme system with React Context

---

## Tasks Breakdown

* Task 1: Install and configure React Navigation (bottom tabs + native stack)
* Task 2: Create navigation structure and type definitions
* Task 3: Build the design system tokens (colors, typography, spacing)
* Task 4: Implement ThemeProvider context (light + dark mode)
* Task 5: Build reusable components (Button, Card, StatCard, Badge, Avatar, EmptyState)
* Task 6: Install and configure MapLibre GL Native
* Task 7: Build Home Dashboard screen
* Task 8: Build Active Trek screen (map + HUD + controls)
* Task 9: Build Trek Summary screen (stats + elevation chart + route preview)
* Task 10: Build Trek History screen (list + search + filters)
* Task 11: Build Profile screen (stats + edit form)
* Task 12: Build Settings screen
* Task 13: Connect screens to TrekRecorder context and API hooks
* Task 14: Write component snapshot tests

---

## File Structure for This Phase

```
mobile/src/
├── App.tsx                               # Root: providers → NavigationContainer
├── navigation/
│   ├── index.tsx                          # NavigationContainer + linking config
│   ├── types.ts                           # RootStackParamList, TabParamList
│   ├── BottomTabs.tsx                     # Tab navigator (Home, Trek, History, Profile)
│   ├── HomeStack.tsx                      # Home → ActiveTrek → Summary
│   └── ProfileStack.tsx                   # Profile → Settings → EditProfile
├── theme/
│   ├── tokens.ts                          # Colors, typography scale, spacing, radii
│   ├── ThemeContext.tsx                    # Light/Dark toggle provider
│   └── useTheme.ts                        # Hook shortcut
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── StatCard.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── EmptyState.tsx
│   │   └── Modal.tsx
│   ├── map/
│   │   ├── TrekMap.tsx                    # MapLibre map wrapper
│   │   ├── RoutePolyline.tsx              # Animated polyline for active trek
│   │   └── UserMarker.tsx                 # Blue dot + accuracy circle
│   ├── charts/
│   │   └── ElevationProfile.tsx           # SVG line chart (react-native-svg)
│   ├── TrekHUD.tsx                        # (from Phase 4, enhanced)
│   └── TrekControls.tsx                   # Start / Pause / Resume / Stop buttons
├── screens/
│   ├── HomeScreen.tsx
│   ├── ActiveTrekScreen.tsx
│   ├── TrekSummaryScreen.tsx
│   ├── HistoryScreen.tsx
│   ├── ProfileScreen.tsx
│   └── SettingsScreen.tsx
├── hooks/
│   ├── useApi.ts                          # Typed fetch wrapper with auth
│   ├── useTrekHistory.ts                  # Paginated session fetch
│   ├── useUserProfile.ts                  # Profile fetch + mutation
│   └── ...
└── __tests__/
    ├── HomeScreen.test.tsx
    ├── TrekHUD.test.tsx
    └── Button.test.tsx
```

---

## Implementation Guide

### Task 1 — Install Navigation

```bash
cd mobile
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npx pod-install ios
```

### Task 2 — Navigation Types and Structure

`mobile/src/navigation/types.ts`:

```typescript
import { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  Dashboard: undefined;
  ActiveTrek: { activityType: string };
  TrekSummary: { sessionId: string };
};

export type HistoryStackParamList = {
  HistoryList: undefined;
  TrekSummary: { sessionId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

export type TabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};
```

`mobile/src/navigation/BottomTabs.tsx`:

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeStack } from './HomeStack';
import { HistoryStack } from './HistoryStack';
import { ProfileStack } from './ProfileStack';
import { useTheme } from '../theme/useTheme';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function BottomTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tab.Screen name="HistoryTab" component={HistoryStack} options={{ title: 'History' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
```

### Task 3 — Design Tokens

`mobile/src/theme/tokens.ts`:

```typescript
export const colors = {
  light: {
    primary: '#2E7D32',
    primaryLight: '#60AD5E',
    secondary: '#1565C0',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    border: '#E0E0E0',
    error: '#D32F2F',
    success: '#388E3C',
    warning: '#F57C00',
    elevation: '#6A1B9A',
  },
  dark: {
    primary: '#66BB6A',
    primaryLight: '#98EE99',
    secondary: '#42A5F5',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#E0E0E0',
    textSecondary: '#9E9E9E',
    border: '#333333',
    error: '#EF5350',
    success: '#66BB6A',
    warning: '#FFA726',
    elevation: '#CE93D8',
  },
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  stat: { fontSize: 32, fontWeight: '800' as const, lineHeight: 40 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 999,
};
```

### Task 4 — Theme Provider

`mobile/src/theme/ThemeContext.tsx`:

```tsx
import React, { createContext, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { colors, typography, spacing, radii } from './tokens';

type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: typeof colors.light;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  toggle: () => void;
}

export const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme() ?? 'light';
  const [mode, setMode] = useState<ThemeMode>(systemMode);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const theme: Theme = {
    mode,
    colors: colors[mode],
    typography,
    spacing,
    radii,
    toggle,
  };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
```

`mobile/src/theme/useTheme.ts`:

```typescript
import { useContext } from 'react';
import { ThemeContext, Theme } from './ThemeContext';

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be inside ThemeProvider');
  return theme;
}
```

### Task 5 — Reusable Components

`mobile/src/components/ui/StatCard.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}

export function StatCard({ label, value, unit, color }: Props) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.lg }]}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.stat, { color: color ?? colors.text }]}>
        {value}
        {unit && <Text style={[typography.body, { color: colors.textSecondary }]}> {unit}</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3 },
});
```

### Task 6 — MapLibre Integration

```bash
npm install @maplibre/maplibre-react-native
npx pod-install ios
```

`mobile/src/components/map/TrekMap.tsx`:

```tsx
import React, { useRef } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props {
  routeCoordinates?: [number, number][];  // [lng, lat]
  followUser?: boolean;
  children?: React.ReactNode;
}

export function TrekMap({ routeCoordinates, followUser = true, children }: Props) {
  const mapRef = useRef<MapLibreGL.MapView>(null);
  const { mode } = useTheme();

  const styleUrl = mode === 'dark'
    ? 'https://demotiles.maplibre.org/style.json'
    : 'https://demotiles.maplibre.org/style.json';

  return (
    <MapLibreGL.MapView ref={mapRef} style={styles.map} styleURL={styleUrl}>
      <MapLibreGL.Camera followUserLocation={followUser} followZoomLevel={15} />

      <MapLibreGL.UserLocation visible animated />

      {routeCoordinates && routeCoordinates.length >= 2 && (
        <MapLibreGL.ShapeSource
          id="route"
          shape={{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: routeCoordinates },
            properties: {},
          }}
        >
          <MapLibreGL.LineLayer
            id="routeLine"
            style={{ lineColor: '#2E7D32', lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      )}

      {children}
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
```

### Task 7 — Home Screen

`mobile/src/screens/HomeScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/types';
import { StatCard } from '../components/ui/StatCard';
import { useTheme } from '../theme/useTheme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>;

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { colors, typography, spacing } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.h1, { color: colors.text, padding: spacing.lg }]}>
        TrekTrack
      </Text>

      {/* Quick Start */}
      <TouchableOpacity
        style={[styles.startButton, { backgroundColor: colors.primary }]}
        onPress={() => nav.navigate('ActiveTrek', { activityType: 'TREKKING' })}
      >
        <Text style={[typography.h2, { color: '#fff', textAlign: 'center' }]}>Start Trek</Text>
      </TouchableOpacity>

      {/* Lifetime Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statHalf}><StatCard label="Total Distance" value="0" unit="km" /></View>
        <View style={styles.statHalf}><StatCard label="Total Treks" value="0" /></View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statHalf}><StatCard label="Elevation Gained" value="0" unit="m" /></View>
        <View style={styles.statHalf}><StatCard label="Calories Burned" value="0" unit="kcal" /></View>
      </View>

      {/* Recent Treks (placeholder) */}
      <Text style={[typography.h3, { color: colors.text, padding: spacing.lg }]}>Recent Treks</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  startButton: { marginHorizontal: 24, borderRadius: 16, paddingVertical: 20, marginBottom: 24 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16 },
  statHalf: { flex: 1, paddingHorizontal: 4 },
});
```

### Task 8 — Active Trek Screen

`mobile/src/screens/ActiveTrekScreen.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { HomeStackParamList } from '../navigation/types';
import { TrekMap } from '../components/map/TrekMap';
import { TrekHUD } from '../components/TrekHUD';
import { TrekControls } from '../components/TrekControls';
import { useTrekRecorder } from '../context/TrekRecorderContext';

type Route = RouteProp<HomeStackParamList, 'ActiveTrek'>;

export function ActiveTrekScreen() {
  const route = useRoute<Route>();
  const nav = useNavigation();
  const { start, stop, pause, resume, isRecording, stats } = useTrekRecorder();
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    start(route.params.activityType);
    return () => { stop(); };
  }, []);

  // In a full implementation, subscribe to location events to build routeCoords

  const handleStop = async () => {
    await stop();
    nav.goBack();
  };

  return (
    <View style={styles.container}>
      <TrekMap routeCoordinates={routeCoords} followUser />
      <View style={styles.hud}><TrekHUD /></View>
      <View style={styles.controls}>
        <TrekControls
          isRecording={isRecording}
          onPause={pause}
          onResume={resume}
          onStop={handleStop}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hud: { position: 'absolute', top: 60, left: 16, right: 16 },
  controls: { position: 'absolute', bottom: 40, left: 16, right: 16 },
});
```

### Task 9 — Trek Summary Screen

`mobile/src/screens/TrekSummaryScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { HomeStackParamList } from '../navigation/types';
import { StatCard } from '../components/ui/StatCard';
import { TrekMap } from '../components/map/TrekMap';
import { ElevationProfile } from '../components/charts/ElevationProfile';
import { useTheme } from '../theme/useTheme';
import { useApi } from '../hooks/useApi';

type Route = RouteProp<HomeStackParamList, 'TrekSummary'>;

export function TrekSummaryScreen() {
  const route = useRoute<Route>();
  const { colors, typography, spacing } = useTheme();
  const api = useApi();
  const [session, setSession] = useState<any>(null);
  const [track, setTrack] = useState<any>(null);

  useEffect(() => {
    api.get(`/sessions/${route.params.sessionId}/summary`).then(setSession);
    api.get(`/sessions/${route.params.sessionId}/track`).then(setTrack);
  }, [route.params.sessionId]);

  if (!session) return null;

  const routeCoords = track?.features?.map((f: any) => f.geometry.coordinates.slice(0, 2)) ?? [];
  const altitudes = track?.features?.map((f: any) => f.geometry.coordinates[2]).filter(Boolean) ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 250 }}>
        <TrekMap routeCoordinates={routeCoords} followUser={false} />
      </View>

      <View style={{ padding: spacing.lg }}>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
          Trek Summary
        </Text>

        <View style={styles.row}>
          <View style={styles.half}><StatCard label="Distance" value={(session.distance_3d / 1000).toFixed(2)} unit="km" /></View>
          <View style={styles.half}><StatCard label="Duration" value={formatDuration(session.duration_seconds)} /></View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}><StatCard label="Elev. Gain" value={`${session.elevation_gain?.toFixed(0) ?? 0}`} unit="m" color={colors.success} /></View>
          <View style={styles.half}><StatCard label="Elev. Loss" value={`${session.elevation_loss?.toFixed(0) ?? 0}`} unit="m" color={colors.error} /></View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}><StatCard label="Avg Speed" value={session.avg_speed?.toFixed(1) ?? '0'} unit="km/h" /></View>
          <View style={styles.half}><StatCard label="Calories" value={`${session.calories_burned ?? 0}`} unit="kcal" /></View>
        </View>
        <StatCard label="Difficulty" value={session.difficulty_rating ?? 'Easy'} />

        {altitudes.length > 0 && (
          <>
            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg }]}>Elevation Profile</Text>
            <ElevationProfile data={altitudes} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  half: { flex: 1, paddingHorizontal: 4 },
});
```

### Task 10 — History Screen

`mobile/src/screens/HistoryScreen.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/useTheme';
import { useApi } from '../hooks/useApi';

export function HistoryScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const api = useApi();
  const nav = useNavigation<any>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPage = useCallback(async (p: number) => {
    const data = await api.get(`/users/me/history?page=${p}&page_size=20`);
    if (p === 1) setSessions(data.items);
    else setSessions((prev) => [...prev, ...data.items]);
    setHasMore(data.items.length === 20);
  }, [api]);

  useEffect(() => { fetchPage(1); }, []);

  const loadMore = () => {
    if (!hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderRadius: radii.lg }]}
      onPress={() => nav.navigate('TrekSummary', { sessionId: item.id })}
    >
      <Text style={[typography.h3, { color: colors.text }]}>
        {item.activity_type} — {new Date(item.start_time).toLocaleDateString()}
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        {(item.distance_3d / 1000).toFixed(2)} km · {item.difficulty_rating ?? 'Easy'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextInput
        style={[styles.search, { backgroundColor: colors.surface, color: colors.text, borderRadius: radii.md }]}
        placeholder="Search treks..."
        placeholderTextColor={colors.textSecondary}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ padding: spacing.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  search: { margin: 16, padding: 12, fontSize: 16 },
  card: { padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 },
});
```

---

## Dependencies

```json
{
  "@react-navigation/native": "^6.1.0",
  "@react-navigation/native-stack": "^6.9.0",
  "@react-navigation/bottom-tabs": "^6.5.0",
  "react-native-screens": "^3.29.0",
  "react-native-safe-area-context": "^4.8.0",
  "@maplibre/maplibre-react-native": "^10.0.0",
  "react-native-svg": "^15.0.0"
}
```

---

## Expected Output

After completing this phase:

1. The app has a polished bottom-tab navigation with Home, History, and Profile tabs.
2. Home screen shows a large "Start Trek" button and lifetime stats.
3. Active Trek screen renders a full-screen map with live polyline drawing and the HUD overlay.
4. Trek Summary shows all computed stats in a card layout with an elevation profile chart.
5. History screen displays past treks with infinite scroll and search.
6. Light and dark themes are fully functional and follow the system setting.

---

## Testing Instructions

### 1. Component Snapshot Tests

```bash
cd mobile
npx jest --testPathPattern='__tests__/(HomeScreen|TrekHUD|Button)'
```

### 2. Navigation Smoke Test

- Launch app on simulator
- Tap each bottom tab → verify correct screen renders
- Tap "Start Trek" → verify Active Trek screen opens with map
- Press back → verify proper stack navigation

### 3. Theme Toggle

- Switch device to dark mode → verify all screens use dark tokens
- Toggle within Settings → verify theme updates across all screens

### 4. Map Rendering

- Active Trek screen → verify MapLibre map loads tiles, shows blue dot
- Trek Summary screen → verify route polyline renders correctly
