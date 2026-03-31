import { RingBuffer } from '../services/location/RingBuffer';
import { GPSReading } from '../services/location/LocationProvider';

function makeReading(index: number): GPSReading {
  return {
    latitude: index,
    longitude: index,
    altitude: index * 10,
    accuracy: 5,
    speed: null,
    heading: null,
    timestamp: index * 1000,
  };
}

describe('RingBuffer', () => {
  it('should start empty', () => {
    const buf = new RingBuffer(10);
    expect(buf.size).toBe(0);
    expect(buf.getAll()).toHaveLength(0);
    expect(buf.getLast()).toBeNull();
  });

  it('should store and retrieve readings', () => {
    const buf = new RingBuffer(10);
    buf.push(makeReading(1));
    buf.push(makeReading(2));
    buf.push(makeReading(3));

    expect(buf.size).toBe(3);
    const all = buf.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].latitude).toBe(1);
    expect(all[2].latitude).toBe(3);
  });

  it('should return the last reading', () => {
    const buf = new RingBuffer(10);
    buf.push(makeReading(1));
    buf.push(makeReading(2));

    expect(buf.getLast()?.latitude).toBe(2);
  });

  it('should wrap around correctly at capacity', () => {
    const capacity = 5;
    const buf = new RingBuffer(capacity);

    // Push 8 items into a buffer of size 5
    for (let i = 1; i <= 8; i++) {
      buf.push(makeReading(i));
    }

    expect(buf.size).toBe(capacity);
    expect(buf.isFull()).toBe(true);

    const all = buf.getAll();
    expect(all).toHaveLength(capacity);

    // Should contain items 4, 5, 6, 7, 8 (oldest 3 evicted)
    expect(all[0].latitude).toBe(4);
    expect(all[4].latitude).toBe(8);
  });

  it('should return latest N readings', () => {
    const buf = new RingBuffer(100);
    for (let i = 1; i <= 50; i++) {
      buf.push(makeReading(i));
    }

    const latest5 = buf.getLatest(5);
    expect(latest5).toHaveLength(5);
    expect(latest5[0].latitude).toBe(46);
    expect(latest5[4].latitude).toBe(50);
  });

  it('should handle getLatest when requesting more than stored', () => {
    const buf = new RingBuffer(100);
    buf.push(makeReading(1));
    buf.push(makeReading(2));

    const latest10 = buf.getLatest(10);
    expect(latest10).toHaveLength(2);
  });

  it('should clear correctly', () => {
    const buf = new RingBuffer(10);
    for (let i = 0; i < 5; i++) {
      buf.push(makeReading(i));
    }

    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.getAll()).toHaveLength(0);
    expect(buf.isFull()).toBe(false);
    expect(buf.getLast()).toBeNull();
  });

  it('should report capacity', () => {
    const buf = new RingBuffer(50000);
    expect(buf.getCapacity()).toBe(50000);
  });

  it('should handle capacity of 1', () => {
    const buf = new RingBuffer(1);
    buf.push(makeReading(1));
    buf.push(makeReading(2));

    expect(buf.size).toBe(1);
    expect(buf.getLast()?.latitude).toBe(2);
  });
});
