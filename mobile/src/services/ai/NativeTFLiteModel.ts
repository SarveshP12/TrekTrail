import { Platform } from 'react-native';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { TFLiteModel } from './ActivityClassifier';

export class NativeTFLiteModel implements TFLiteModel {
  private model: TensorflowModel | null = null;
  private isAvailable = false;

  async init(modelAsset: any): Promise<void> {
    try {
      // Use Core ML delegate on iOS for hardware acceleration (Task 7 requirement)
      // Use standard/nnapi on Android 
      const delegate = Platform.OS === 'ios' ? 'core-ml' : 'default';

      this.model = await loadTensorflowModel(modelAsset, delegate);
      this.isAvailable = true;
      console.log(`[NativeTFLiteModel] Loaded model with delegate: ${delegate}`);
    } catch (e) {
      console.error('[NativeTFLiteModel] Failed to load model:', e);
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
