import { GPSReading } from './LocationProvider';

/**
 * Fixed-capacity ring buffer for GPS readings.
 * When full, oldest entries are overwritten (FIFO eviction).
 * Default capacity: 50,000 points per session.
 */
export class RingBuffer {
  private buffer: GPSReading[];
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 50000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /** Push a new reading into the buffer. Overwrites oldest if full. */
  push(reading: GPSReading): void {
    this.buffer[this.head] = reading;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Get all readings in chronological order. */
  getAll(): GPSReading[] {
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count);
    }
    // Wrap-around: tail is at head position
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }

  /** Get the latest N readings in chronological order. */
  getLatest(n: number): GPSReading[] {
    const all = this.getAll();
    return all.slice(Math.max(0, all.length - n));
  }

  /** Get the most recent single reading, or null if empty. */
  getLast(): GPSReading | null {
    if (this.count === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  /** Current number of stored readings. */
  get size(): number {
    return this.count;
  }

  /** Maximum capacity of the buffer. */
  getCapacity(): number {
    return this.capacity;
  }

  /** True if the buffer has reached capacity and is overwriting old entries. */
  isFull(): boolean {
    return this.count >= this.capacity;
  }

  /** Clear all readings and reset pointers. */
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
