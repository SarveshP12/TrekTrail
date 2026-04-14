import { Platform, TurboModuleRegistry } from 'react-native';
import { TFLiteModel } from './ActivityClassifier';

// NOTE: react-native-fast-tflite requires the 'Tflite' TurboModule to be linked
// in the native binary. In Expo Go this module is NOT available — we detect this
// upfront via TurboModuleRegistry.get() (non-throwing) to avoid the Invariant
// Violation that getEnforcing() would raise inside the package.

export class NativeTFLiteModel implements TFLiteModel {
  private model: any = null;
  private isAvailable = false;

  async init(modelAsset: any): Promise<void> {
    // 1. Probe for the native module BEFORE requiring the JS package.
    //    TurboModuleRegistry.get() returns null instead of throwing when
    //    the module isn't registered in the native binary.
    const nativeModule = TurboModuleRegistry.get('Tflite');

    if (!nativeModule) {
      throw new Error(
        'react-native-fast-tflite is not available (Tflite TurboModule not found). ' +
        'This is expected in Expo Go — use a custom dev client for TFLite support.'
      );
    }

    // 2. Native module exists — safe to require the JS wrapper
    try {
      const { loadTensorflowModel } = require('react-native-fast-tflite');

      // Use Core ML delegate on iOS for hardware acceleration
      // Use standard/nnapi on Android
      const delegate = Platform.OS === 'ios' ? 'core-ml' : 'default';

      this.model = await loadTensorflowModel(modelAsset, delegate);
      this.isAvailable = true;
      console.log(`[NativeTFLiteModel] Loaded model with delegate: ${delegate}`);
    } catch (e: any) {
      console.warn('[NativeTFLiteModel] TFLite load error:', e?.message ?? e);
      throw e;
    }
  }

  async run(input: Float32Array): Promise<Float32Array> {
    if (!this.isAvailable || !this.model) {
      throw new Error('Model is not initialized.');
    }

    // TFLite expects an array of TypedArrays for inputs
    const result = await this.model.run([input]);

    // The output is an array of TypedArrays, we want the first (and only) probability array
    return result[0] as Float32Array;
  }

  close(): void {
    // Fast TFLite doesn't expose a close() method explicitly,
    // but we can release the JS reference.
    this.model = null;
    this.isAvailable = false;
  }
}


