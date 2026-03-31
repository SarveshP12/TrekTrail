import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePermissions, PermissionLevel } from '../hooks/usePermissions';

interface PermissionGateProps {
  children: React.ReactNode;
  /** Minimum permission level required. Defaults to 'foreground'. */
  requiredLevel?: PermissionLevel;
}

/**
 * Blocks rendering of children until location permissions are granted.
 * Shows a user-friendly permission request screen when access is denied.
 */
export function PermissionGate({
  children,
  requiredLevel = 'foreground',
}: PermissionGateProps) {
  const { level, isChecking, requestAll, requestForeground } = usePermissions();

  if (isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.subtitle}>Checking permissions…</Text>
      </View>
    );
  }

  const hasRequired =
    requiredLevel === 'foreground'
      ? level === 'foreground' || level === 'background'
      : level === 'background';

  if (!hasRequired) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={64} color="#10B981" />
        </View>

        <Text style={styles.title}>Location Access Required</Text>
        <Text style={styles.subtitle}>
          TrekTrack needs access to your GPS to record treks, calculate
          distances, and track elevation changes.
        </Text>

        {requiredLevel === 'background' && (
          <View style={styles.featureList}>
            <FeatureRow
              icon="walk"
              text="Track your trek even when the app is in the background"
            />
            <FeatureRow
              icon="analytics"
              text="Accurate 3D distance calculation with elevation"
            />
            <FeatureRow
              icon="battery-half"
              text="Battery-optimized GPS that adjusts to your pace"
            />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={
            requiredLevel === 'background' ? requestAll : requestForeground
          }
        >
          <Ionicons
            name="shield-checkmark"
            size={20}
            color="#FFF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.buttonText}>Enable Location</Text>
        </Pressable>

        <Text style={styles.privacyNote}>
          Your location data stays on your device and is only shared with the
          TrekTrack cloud when you explicitly sync a trek session.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={icon as any}
        size={20}
        color="#10B981"
        style={{ marginRight: 12 }}
      />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  privacyNote: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
});
