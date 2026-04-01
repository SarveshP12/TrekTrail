import { BatchUploader } from '../services/sync/BatchUploader';
import { GPSReading } from '../services/location/LocationProvider';

// Mock the ConnectivityMonitor
jest.mock('../services/sync/ConnectivityMonitor', () => {
  const { EventEmitter } = require('node:events');
  class MockConnectivityMonitor extends EventEmitter {
    _isConnected = true;
    start() {}
    stop() {}
    get isConnected() { return this._isConnected; }
    async checkConnection() { return this._isConnected; }
    setConnected(val: boolean) { this._isConnected = val; }
  }
  const instance = new MockConnectivityMonitor();
  return { connectivityMonitor: instance };
});

const { connectivityMonitor } = require('../services/sync/ConnectivityMonitor');

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

function makeReading(index: number): GPSReading {
  return {
    latitude: index * 0.001,
    longitude: index * 0.001,
    altitude: 100 + index,
    accuracy: 5,
    speed: 1.5,
    heading: 90,
    timestamp: Date.now() + index * 1000,
  };
}

describe('BatchUploader', () => {
  let uploader: BatchUploader;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    uploader = new BatchUploader('http://localhost:8000', 'test-token');
    uploader.setSession('session-123');
  });

  afterEach(() => {
    uploader.stop();
    jest.useRealTimers();
  });

  it('should start with 0 pending', () => {
    expect(uploader.getPendingCount()).toBe(0);
  });

  it('should enqueue readings', () => {
    uploader.enqueue(makeReading(1));
    uploader.enqueue(makeReading(2));
    expect(uploader.getPendingCount()).toBe(2);
  });

  it('should flush successfully when online', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    connectivityMonitor.setConnected(true);

    uploader.enqueue(makeReading(1));
    uploader.enqueue(makeReading(2));

    await uploader.flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(uploader.getPendingCount()).toBe(0);
  });

  it('should not flush when offline', async () => {
    connectivityMonitor.setConnected(false);

    uploader.enqueue(makeReading(1));
    await uploader.flush();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(uploader.getPendingCount()).toBe(1);
  });

  it('should not flush without a session', async () => {
    const noSessionUploader = new BatchUploader('http://localhost:8000', 'test-token');
    noSessionUploader.enqueue(makeReading(1));

    await noSessionUploader.flush();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not flush when queue is empty', async () => {
    await uploader.flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should re-queue batch on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    connectivityMonitor.setConnected(true);

    uploader.enqueue(makeReading(1));
    uploader.enqueue(makeReading(2));

    await uploader.flush();

    // Points should be re-queued
    expect(uploader.getPendingCount()).toBe(2);
  });

  it('should re-queue batch on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    connectivityMonitor.setConnected(true);

    uploader.enqueue(makeReading(1));
    await uploader.flush();

    expect(uploader.getPendingCount()).toBe(1);
  });

  it('should send correct payload structure', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    connectivityMonitor.setConnected(true);

    const reading = makeReading(1);
    uploader.enqueue(reading);
    await uploader.flush();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/sessions/session-123/points');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-token');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.session_id).toBe('session-123');
    expect(body.points).toHaveLength(1);
    expect(body.points[0]).toHaveProperty('latitude');
    expect(body.points[0]).toHaveProperty('longitude');
    expect(body.points[0]).toHaveProperty('altitude');
  });

  it('should batch in groups of 100', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    connectivityMonitor.setConnected(true);

    // Enqueue 250 points
    for (let i = 0; i < 250; i++) {
      uploader.enqueue(makeReading(i));
    }

    await uploader.flush();

    // Should have made 3 fetch calls (100 + 100 + 50)
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(uploader.getPendingCount()).toBe(0);
  });

  it('should clear queue', () => {
    uploader.enqueue(makeReading(1));
    uploader.enqueue(makeReading(2));
    uploader.clearQueue();
    expect(uploader.getPendingCount()).toBe(0);
  });
});
