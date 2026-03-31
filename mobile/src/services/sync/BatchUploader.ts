import { GPSReading } from '../location/LocationProvider';
import { connectivityMonitor } from './ConnectivityMonitor';

const BATCH_SIZE = 100;
const UPLOAD_INTERVAL_MS = 15000; // attempt upload every 15 sec

/**
 * Network-aware GPS point batch uploader.
 * Queues GPS points locally and uploads them in batches
 * when the device has network connectivity.
 */
export class BatchUploader {
  private queue: GPSReading[] = [];
  private sessionId: string | null = null;
  private token: string;
  private baseUrl: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isUploading: boolean = false;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /** Set the active session ID for uploads. */
  setSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /** Update the auth token (e.g. after refresh). */
  setToken(token: string): void {
    this.token = token;
  }

  /** Add a GPS reading to the upload queue. */
  enqueue(reading: GPSReading): void {
    this.queue.push(reading);
  }

  /** Start periodic upload attempts. */
  start(): void {
    this.timer = setInterval(() => this.flush(), UPLOAD_INTERVAL_MS);
  }

  /** Stop periodic upload attempts. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Attempt to upload all queued points.
   * Checks network connectivity before sending.
   * Failed batches are re-queued for retry.
   */
  async flush(): Promise<void> {
    if (!this.sessionId || this.queue.length === 0 || this.isUploading) return;

    const isConnected = await connectivityMonitor.checkConnection();
    if (!isConnected) return;

    this.isUploading = true;

    try {
      while (this.queue.length > 0) {
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
          const resp = await fetch(
            `${this.baseUrl}/sessions/${this.sessionId}/points`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            },
          );
          if (!resp.ok) {
            // Re-add failed batch to front of queue
            this.queue.unshift(...batch);
            break; // Stop trying this cycle
          }
        } catch {
          this.queue.unshift(...batch);
          break;
        }
      }
    } finally {
      this.isUploading = false;
    }
  }

  /** Number of points currently waiting to be uploaded. */
  getPendingCount(): number {
    return this.queue.length;
  }

  /** Clear the upload queue (e.g. on session abort). */
  clearQueue(): void {
    this.queue = [];
  }
}
