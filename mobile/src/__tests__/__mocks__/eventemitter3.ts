// Mock for eventemitter3 — use Node's built-in EventEmitter for test compatibility
import { EventEmitter } from 'node:events';
export default EventEmitter;
export { EventEmitter };
