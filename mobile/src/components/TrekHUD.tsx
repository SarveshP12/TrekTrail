import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useTrekRecorder } from '../context/TrekRecorderContext';

// ── Formatters ──────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatSpeed(mps: number): string {
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function formatPace(pace: number | null): string {
  if (!pace) return '--:--';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}

function formatAltitude(alt: number | null): string {
  if (alt === null) return '--';
  return `${alt.toFixed(0)} m`;
}

// ── Components ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RecordingIndicator() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.recordingRow}>
      <Animated.View style={[styles.recordingDot, animStyle]} />
      <Text style={styles.recordingText}>RECORDING</Text>
    </View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function TrekHUD() {
  const { stats, state } = useTrekRecorder();

  const slideIn = useSharedValue(100);

  useEffect(() => {
    slideIn.value = withSpring(0, { damping: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideIn.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Recording indicator */}
      {state === 'recording' && <RecordingIndicator />}
      {state === 'paused' && (
        <View style={styles.recordingRow}>
          <View style={[styles.recordingDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.recordingText, { color: '#F59E0B' }]}>
            PAUSED
          </Text>
        </View>
      )}

      {/* Duration - prominent */}
      <Text style={styles.duration}>{formatDuration(stats.durationMs)}</Text>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Distance"
          value={formatDistance(stats.distance3D)}
          icon="📏"
          highlight
        />
        <StatCard
          label="Speed"
          value={formatSpeed(stats.speed)}
          icon="⚡"
        />
        <StatCard
          label="Elevation ↑"
          value={`${stats.elevationGain.toFixed(0)} m`}
          icon="⛰️"
        />
        <StatCard
          label="Altitude"
          value={formatAltitude(stats.altitude)}
          icon="🏔️"
        />
        <StatCard
          label="Avg Speed"
          value={formatSpeed(stats.avgSpeed)}
          icon="📊"
        />
        <StatCard
          label="Pace"
          value={formatPace(stats.pace)}
          icon="🏃"
        />
      </View>

      {/* Bottom info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {stats.pointCount} pts • {stats.pendingSyncCount} pending
        </Text>
        {stats.elevationLoss > 0 && (
          <Text style={styles.infoText}>
            ↓ {stats.elevationLoss.toFixed(0)} m
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    // Glassmorphism shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  duration: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '200',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
  },
});
