import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';
import EventEmitter from 'eventemitter3';

/**
 * Wraps NetInfo to provide a simple online/offline event emitter.
 * Components can subscribe to connectivity changes via events.
 */
class ConnectivityMonitor extends EventEmitter {
  private _isConnected: boolean = false;
  private subscription: NetInfoSubscription | null = null;

  /** Start monitoring connectivity changes. */
  start(): void {
    this.subscription = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = !!state.isConnected;
      if (connected !== this._isConnected) {
        this._isConnected = connected;
        this.emit('change', connected);
        if (connected) {
          this.emit('online');
        } else {
          this.emit('offline');
        }
      }
    });

    // Initialize current state
    NetInfo.fetch().then((state) => {
      this._isConnected = !!state.isConnected;
    });
  }

  /** Stop monitoring. */
  stop(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
  }

  /** Check if currently online. */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /** Async check — fetches live state. */
  async checkConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this._isConnected = !!state.isConnected;
    return this._isConnected;
  }
}

export const connectivityMonitor = new ConnectivityMonitor();
