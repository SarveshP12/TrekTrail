import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { PermissionGate } from '../src/components/PermissionGate';
import { TrekHUD } from '../src/components/TrekHUD';
import { TrekMap } from '../src/components/map/TrekMap';
import { TrekControls } from '../src/components/TrekControls';
import { useTrekRecorder, TrekState } from '../src/context/TrekRecorderContext';

export default function TrekScreen() {
  return (
    <PermissionGate requiredLevel="foreground">
      <TrekContent />
    </PermissionGate>
  );
}

function TrekContent() {
  const router = useRouter();
  const { state, stats, start, stop, pause, resume } = useTrekRecorder();

  // Animations
  const buttonScale = useSharedValue(1);
  const hudOpacity = useSharedValue(0);

  useEffect(() => {
    if (state !== 'idle') {
      hudOpacity.value = withTiming(1, { duration: 400 });
    } else {
      hudOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [state]);

  const hudAnimStyle = useAnimatedStyle(() => ({
    opacity: hudOpacity.value,
  }));

  // Handlers
  const handleStart = useCallback(async () => {
    try {
      await start('TREKKING');
    } catch (err) {
      Alert.alert('Error', 'Failed to start trek. Please try again.');
    }
  }, [start]);

  const handleStop = useCallback(async () => {
    Alert.alert(
      'End Trek',
      'Are you sure you want to stop recording this trek?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Trek',
          style: 'destructive',
          onPress: async () => {
            await stop();
          },
        },
      ],
    );
  }, [stop]);

  const handlePauseResume = useCallback(async () => {
    if (state === 'recording') {
      pause();
    } else if (state === 'paused') {
      await resume();
    }
  }, [state, pause, resume]);

  const handleBack = useCallback(() => {
    if (state !== 'idle') {
      Alert.alert(
        'Trek in Progress',
        'You have an active trek. Going back will continue recording in the background.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Go Back', onPress: () => router.back() },
        ],
      );
    } else {
      router.back();
    }
  }, [state, router]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.topTitle}>
            {state === 'idle' ? 'Start Trek' : 'Active Trek'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Main content */}
        <View style={styles.mainContent}>
          {state === 'idle' ? (
            /* Idle state — Start button */
            <View style={styles.idleContainer}>
              <View style={styles.readyIconContainer}>
                <Ionicons name="navigate" size={48} color="#10B981" />
              </View>
              <Text style={styles.readyTitle}>Ready to Trek</Text>
              <Text style={styles.readySubtitle}>
                GPS will track your distance, speed, elevation, and more in
                real-time.
              </Text>

              <Animated.View style={buttonAnimStyle}>
                <Pressable
                  style={({ pressed }) => [
                    styles.startButton,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={handleStart}
                >
                  <Ionicons
                    name="play"
                    size={28}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.startButtonText}>START TREK</Text>
                </Pressable>
              </Animated.View>
            </View>
          ) : (
            /* Recording / Paused state */
            <View style={styles.activeContainer}>
              {/* Map view from Phase 5 */}
              <View style={styles.mapContainer}>
                <TrekMap routeCoordinates={[]} followUser />
              </View>

              {/* Controls */}
              <View style={styles.controlsRowWrapper}>
                <TrekControls
                  isRecording={state === 'recording'}
                  onPause={handlePauseResume}
                  onResume={handlePauseResume}
                  onStop={handleStop}
                />
              </View>
            </View>
          )}
        </View>

        {/* HUD overlay — visible when recording or paused */}
        {state !== 'idle' && (
          <Animated.View style={[styles.hudWrapper, hudAnimStyle]}>
            <TrekHUD />
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  // ── Idle State ──
  idleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  readyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  readyTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  readySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  // ── Active State ──
  activeContainer: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  controlsRowWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // ── HUD ──
  hudWrapper: {
    position: 'absolute',
    top: 100, // Move HUD above map and controls
    left: 0,
    right: 0,
  },
});
