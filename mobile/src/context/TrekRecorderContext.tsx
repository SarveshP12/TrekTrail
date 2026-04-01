import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  PropsWithChildren
} from 'react';
import * as Crypto from 'expo-crypto';
import { gpsRepo } from '../services/db/gps-repository';
import { locationProvider, GPSReading } from '../services/location/LocationProvider';
import { BackgroundTracker } from '../services/location/BackgroundTracker';
import { RingBuffer } from '../services/location/RingBuffer';
import { DutyCycleManager } from '../services/location/DutyCycleManager';
import { TrekStatsEngine, TrekStatsSnapshot } from '../services/tracking/TrekStatsEngine';
import { BatchUploader } from '../services/sync/BatchUploader';
import { connectivityMonitor } from '../services/sync/ConnectivityMonitor';

export type TrekState = 'idle' | 'recording' | 'paused';

export interface TrekStats extends TrekStatsSnapshot {
  state: TrekState;
  pendingSyncCount: number;
}

interface TrekRecorderContextType {
  state: TrekState;
  stats: TrekStats;
  currentSessionId: string | null;
  start: (activityType?: string) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

const TrekRecorderContext = createContext<TrekRecorderContextType | null>(null);

const DEFAULT_API_URL = 'http://10.0.2.2:8000'; // Default to localhost for Android Emulator

function emptyStats(): TrekStats {
  return {
    distance2D: 0,
    distance3D: 0,
    speed: 0,
    avgSpeed: 0,
    altitude: null,
    elevationGain: 0,
    elevationLoss: 0,
    minAltitude: null,
    maxAltitude: null,
    durationMs: 0,
    pointCount: 0,
    pace: null,
    state: 'idle',
    pendingSyncCount: 0,
  };
}

export function TrekRecorderProvider({
  children,
  apiBaseUrl = DEFAULT_API_URL,
  token = '',
}: PropsWithChildren<{ apiBaseUrl?: string; token?: string }>) {
  const [trekState, setTrekState] = useState<TrekState>('idle');
  const [stats, setStats] = useState<TrekStats>(emptyStats());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const buffer = useRef(new RingBuffer(50000));
  const statsEngine = useRef(new TrekStatsEngine(30000));
  const dutyCycle = useRef(new DutyCycleManager());
  const uploader = useRef(new BatchUploader(apiBaseUrl, token));
  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Ref to hold the current session ID for callbacks
  const sessionIdRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Start connectivity monitoring on mount
  useEffect(() => {
    try {
      connectivityMonitor.start();
    } catch (e) {
      console.warn('ConnectivityMonitor failed to start:', e);
    }
    return () => {
      try {
        connectivityMonitor.stop();
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, []);

  // Update stats at a fixed interval (every 500ms) for smooth UI updates
  const startStatsPolling = useCallback(() => {
    if (statsInterval.current) clearInterval(statsInterval.current);
    statsInterval.current = setInterval(() => {
      const snapshot = statsEngine.current.getStats();
      setStats((prev) => ({
        ...snapshot,
        state: prev.state,
        pendingSyncCount: uploader.current.getPendingCount(),
      }));
    }, 500);
  }, []);

  const stopStatsPolling = useCallback(() => {
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }
  }, []);

  const handleReading = useCallback(async (reading: GPSReading) => {
    // In-memory buffer for UI map - DB Write is handled by BackgroundTracker
    buffer.current.push(reading);
    statsEngine.current.addReading(reading);
    dutyCycle.current.onReading(reading);
    uploader.current.enqueue(reading);
  }, []);

  // Restore active session on mount (delayed to avoid blocking app registration)
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      // Small delay to let the app fully register before doing I/O
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!mounted) return;
      try {
        const activeId = await gpsRepo.getActiveSession();
        if (activeId && mounted) {
          console.log(`Restoring active session: ${activeId}`);
          setCurrentSessionId(activeId);
          setTrekState('recording');
          setStats(prev => ({ ...prev, state: 'recording' }));
          
          // Re-attach listeners
          locationProvider.on('location', handleReading);
          locationProvider.startWatching(1000).catch(() => {});
          uploader.current.start();
          statsEngine.current.start();
          startStatsPolling();
        }
      } catch (e) {
        console.warn('Failed to restore session (non-fatal):', e);
      }
    };
    restoreSession();
    return () => { mounted = false; };
  }, [handleReading, startStatsPolling]);

  const start = useCallback(
    async (activityType: string = 'TREKKING') => {
      console.log('Starting recording...');
      
      // 1. Generate Local Session ID
      const sessionId = Crypto.randomUUID();
      setCurrentSessionId(sessionId);
      sessionIdRef.current = sessionId;
      
      // 2. Reset engines
      buffer.current.clear();
      statsEngine.current.reset();
      dutyCycle.current.reset();
      uploader.current.clearQueue();

      // 3. Create Session in Local DB
      try {
        await gpsRepo.createSession(sessionId, Date.now());
        console.log(`Local session created: ${sessionId}`);
      } catch (e) {
        console.error('Failed to create local session:', e);
      }

      // 4. Try creating session on backend (non-blocking)
      try {
        // Here we would normally call the API
        // For now, we simulate success or just let the uploader handle it later
        if (uploader.current.setSession) {
             uploader.current.setSession(sessionId);
        }
      } catch {
        console.log('[TrekRecorder] Backend unreachable, continuing offline');
      }

      // 5. Start GPS tracking
      try {
        await BackgroundTracker.start(() => {}); // Start background service
      } catch (e) {
        console.error('Failed to start background tracker:', e);
      }
      
      locationProvider.on('location', handleReading);
      locationProvider.startWatching(1000).catch(console.error);
      uploader.current.start();
      statsEngine.current.start();

      setTrekState('recording');
      setStats((prev) => ({ ...prev, state: 'recording' }));
      startStatsPolling();
    },
    [handleReading, startStatsPolling],
  );

  const stop = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid && trekState === 'idle') return;

    locationProvider.stopWatching();
    locationProvider.removeAllListeners('location');
    
    await BackgroundTracker.stop();
    await uploader.current.flush();
    uploader.current.stop();
    stopStatsPolling();

    const finalSnapshot = statsEngine.current.getStats();

    if (sid) {
        try {
            // Persist final stats to local DB
            await gpsRepo.updateSessionStats(
              sid,
              finalSnapshot.durationMs,
              finalSnapshot.distance3D,
              finalSnapshot.elevationGain,
              finalSnapshot.elevationLoss,
            );
            await gpsRepo.endSession(sid, Date.now());
            console.log(`Local session ended: ${sid}`);
        } catch(e) {
            console.error("Failed to end local session:", e);
        }
    }

    setStats({
      ...finalSnapshot,
      state: 'idle',
      pendingSyncCount: uploader.current.getPendingCount(),
    });
    setTrekState('idle');
    setCurrentSessionId(null);
  }, [stopStatsPolling, trekState]);

  const pause = useCallback(() => {
    locationProvider.stopWatching();
    statsEngine.current.pause();
    setTrekState('paused');
    setStats((prev) => ({ ...prev, state: 'paused' }));
  }, []);

  const resume = useCallback(async () => {
    statsEngine.current.resume();
    locationProvider.on('location', handleReading);
    await locationProvider.startWatching(1000);
    setTrekState('recording');
    setStats((prev) => ({ ...prev, state: 'recording' }));
  }, [handleReading]);

  return (
    <TrekRecorderContext.Provider
      value={{ 
          state: trekState, 
          stats, 
          currentSessionId,
          start, 
          stop, 
          pause, 
          resume 
      }}
    >
      {children}
    </TrekRecorderContext.Provider>
  );
}

export function useTrekRecorder() {
  const ctx = useContext(TrekRecorderContext);
  if (!ctx) {
    throw new Error(
      'useTrekRecorder must be used inside a TrekRecorderProvider',
    );
  }
  return ctx;
}
