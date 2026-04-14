"""
export_tflite.py — Export XGBoost model to TFLite via ONNX

Pipeline: XGBoost (.xgb) → ONNX (.onnx) → TensorFlow SavedModel → TFLite (.tflite)

This enables on-device inference on Android (TFLite) and iOS (Core ML via TFLite).

Usage:
    python export_tflite.py --model ../models/activity_classifier.json
    python export_tflite.py --model ../models/activity_classifier.json --quantize
"""

from __future__ import annotations

import json
import os
import shutil

import numpy as np


def export_xgboost_to_onnx(
    model_path: str,
    onnx_path: str,
    num_features: int,
) -> str:
    """
    Convert an XGBoost model to ONNX format.

    Args:
        model_path: Path to the saved XGBoost model (.json or .xgb)
        onnx_path: Output path for the ONNX model
        num_features: Number of input features

    Returns:
        Path to the saved ONNX model.
    """
    import onnxmltools
    from onnxmltools.convert import convert_xgboost
    from onnxmltools.utils import FloatTensorType
    import xgboost as xgb

    print(f"  Loading XGBoost model from {model_path}...")
    model = xgb.XGBClassifier()
    model.load_model(model_path)

    print(f"  Converting to ONNX (input shape: [{num_features}])...")
    initial_type = [("features", FloatTensorType([None, num_features]))]
    onnx_model = convert_xgboost(
        model,
        initial_types=initial_type,
        target_opset=13,
    )

    onnxmltools.utils.save_model(onnx_model, onnx_path)
    print(f"  Saved ONNX model: {onnx_path}")
    return onnx_path


def export_onnx_to_tf_savedmodel(
    onnx_path: str,
    savedmodel_dir: str,
) -> str:
    """
    Convert ONNX model to TensorFlow SavedModel format.

    Args:
        onnx_path: Path to ONNX model
        savedmodel_dir: Output directory for TF SavedModel

    Returns:
        Path to the SavedModel directory.
    """
    import onnx
    from onnx_tf.backend import prepare  # type: ignore

    print(f"  Loading ONNX model from {onnx_path}...")
    onnx_model = onnx.load(onnx_path)

    print("  Converting ONNX → TF SavedModel...")
    tf_rep = prepare(onnx_model)

    if os.path.exists(savedmodel_dir):
        shutil.rmtree(savedmodel_dir)

    tf_rep.export_graph(savedmodel_dir)
    print(f"  Saved TF model: {savedmodel_dir}")
    return savedmodel_dir


def export_tf_to_tflite(
    savedmodel_dir: str,
    tflite_path: str,
    quantize: bool = False,
    num_features: int = 20,
) -> str:
    """
    Convert TF SavedModel to TFLite format.

    Args:
        savedmodel_dir: Path to TF SavedModel
        tflite_path: Output path for TFLite model
        quantize: Whether to apply dynamic range quantization
        num_features: Number of input features (for representative dataset)

    Returns:
        Path to the TFLite model.
    """
    import tensorflow as tf

    print("  Converting TF SavedModel → TFLite...")
    converter = tf.lite.TFLiteConverter.from_saved_model(savedmodel_dir)

    if quantize:
        print("  Applying dynamic range quantization...")
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

        # Representative dataset for full integer quantization
        def representative_dataset():
            for _ in range(100):
                data = np.random.randn(1, num_features).astype(np.float32)
                yield [data]

        converter.representative_dataset = representative_dataset

    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS,
    ]

    tflite_model = converter.convert()

    with open(tflite_path, "wb") as f:
        f.write(tflite_model)

    size_kb = os.path.getsize(tflite_path) / 1024
    print(f"  Saved TFLite model: {tflite_path} ({size_kb:.1f} KB)")

    # ─── Export to Core ML ──────────────────────────────────────
    try:
        import coremltools as ct

        print("  Converting TF SavedModel → Core ML (.mlmodel)...")
        # Load the saved model and convert it
        input_feature = ct.TensorType(name="features", shape=(1, num_features))
        mlmodel = ct.convert(
            savedmodel_dir, inputs=[input_feature], convert_to="neuralnetwork"
        )
        mlmodel_path = tflite_path.replace(".tflite", ".mlmodel")
        mlmodel.save(mlmodel_path)
        print(f"  Saved Core ML model: {mlmodel_path}")
    except ImportError:
        print("  coremltools not installed, skipping Core ML export.")
    except Exception as e:
        print(f"  Core ML export failed: {e}")

    return tflite_path


def export_direct_tflite(
    model_path: str,
    tflite_path: str,
    scaler_path: str | None = None,
    num_features: int = 20,
    num_classes: int = 5,
    quantize: bool = False,
) -> str:
    """
    Direct XGBoost → TFLite export using a TF wrapper model.

    Instead of the ONNX pipeline (which requires onnx-tf), this approach
    wraps the XGBoost predictions inside a simple TF model that:
    1. Accepts scaled features as input
    2. Runs the trees as a lookup table embedded in TF constants
    3. Outputs class probabilities

    For production, this uses a lightweight neural-network distillation approach:
    train a small MLP to mimic XGBoost predictions, then export the MLP to TFLite.

    Args:
        model_path: Path to XGBoost model (.json or .xgb)
        tflite_path: Output TFLite path
        scaler_path: Optional path to scaler JSON
        num_features: Number of input features
        num_classes: Number of output classes
        quantize: Whether to quantize

    Returns:
        Path to the TFLite model.
    """
    import tensorflow as tf
    import xgboost as xgb

    print(f"  Loading XGBoost model from {model_path}...")
    xgb_model = xgb.XGBClassifier()
    xgb_model.load_model(model_path)

    # Generate distillation training data from XGBoost
    print("  Generating distillation dataset (10000 samples)...")
    rng = np.random.RandomState(42)
    X_distill = rng.randn(10000, num_features).astype(np.float32)

    # Get XGBoost's soft predictions as teacher labels
    y_probs = xgb_model.predict_proba(X_distill)

    # Build a small MLP that mimics XGBoost
    print("  Training distillation MLP...")
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(num_features,)),
            tf.keras.layers.Dense(64, activation="relu"),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dense(num_classes, activation="softmax"),
        ]
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    # Train on XGBoost's soft predictions (knowledge distillation)
    model.fit(
        X_distill,
        y_probs,
        epochs=50,
        batch_size=256,
        validation_split=0.1,
        verbose=0,
    )

    # Evaluate distillation quality
    y_pred_mlp = np.argmax(model.predict(X_distill, verbose=0), axis=1)
    y_pred_xgb = np.argmax(y_probs, axis=1)
    agreement = np.mean(y_pred_mlp == y_pred_xgb)
    print(f"  Distillation agreement: {agreement:.4f}")

    # Convert to TFLite
    print("  Converting MLP → TFLite...")
    os.environ["TF_USE_LEGACY_KERAS"] = "1"
    temp_dir = os.path.join(os.path.dirname(tflite_path), "temp_distill")
    model.export(temp_dir)
    converter = tf.lite.TFLiteConverter.from_saved_model(temp_dir)

    if quantize:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
    ]

    tflite_model = converter.convert()

    with open(tflite_path, "wb") as f:
        f.write(tflite_model)

    size_kb = os.path.getsize(tflite_path) / 1024
    print(f"  Saved TFLite model: {tflite_path} ({size_kb:.1f} KB)")

    # ─── Export to Core ML ──────────────────────────────────────
    try:
        import coremltools as ct

        print("  Converting MLP → Core ML (.mlmodel)...")
        # Convert the Keras model to Core ML
        # We specify input shape and output
        # Using neuralnetwork to export as .mlmodel file format
        input_feature = ct.TensorType(name="dense_input", shape=(1, num_features))
        mlmodel = ct.convert(model, inputs=[input_feature], convert_to="neuralnetwork")

        mlmodel_path = tflite_path.replace(".tflite", ".mlmodel")
        mlmodel.save(mlmodel_path)
        print(f"  Saved Core ML model: {mlmodel_path}")
    except ImportError:
        print("  coremltools not installed, skipping Core ML export.")
    except Exception as e:
        print(f"  Core ML export failed: {e}")

    # Save export metadata alongside the model
    meta = {
        "export_method": "distillation",
        "distillation_agreement": round(float(agreement), 4),
        "num_features": num_features,
        "num_classes": num_classes,
        "quantized": quantize,
        "model_size_kb": round(size_kb, 1),
    }
    meta_path = tflite_path.replace(".tflite", "_export_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  Saved export metadata: {meta_path}")

    return tflite_path


# ─── Full Pipeline ────────────────────────────────────────────────────────────


def full_export_pipeline(
    model_path: str,
    output_dir: str,
    model_name: str = "activity_classifier",
    quantize: bool = False,
    use_onnx: bool = False,
    num_features: int = 20,
    num_classes: int = 5,
) -> dict[str, str]:
    """
    Run the full export pipeline.

    Args:
        model_path: Path to the trained XGBoost model
        output_dir: Directory for output artifacts
        model_name: Base name for output files
        quantize: Whether to quantize the TFLite model
        use_onnx: Use ONNX pipeline (requires onnxmltools & onnx-tf)
        num_features: Number of input features
        num_classes: Number of output classes

    Returns:
        Dictionary of output file paths.
    """
    os.makedirs(output_dir, exist_ok=True)
    paths: dict[str, str] = {}

    q_suffix = "_quantized" if quantize else ""
    tflite_path = os.path.join(output_dir, f"{model_name}{q_suffix}.tflite")

    if use_onnx:
        # ONNX pipeline: XGBoost → ONNX → TF → TFLite
        onnx_path = os.path.join(output_dir, f"{model_name}.onnx")
        savedmodel_dir = os.path.join(output_dir, f"{model_name}_savedmodel")

        export_xgboost_to_onnx(model_path, onnx_path, num_features)
        paths["onnx"] = onnx_path

        export_onnx_to_tf_savedmodel(onnx_path, savedmodel_dir)
        paths["savedmodel"] = savedmodel_dir

        export_tf_to_tflite(savedmodel_dir, tflite_path, quantize, num_features)
        paths["tflite"] = tflite_path
    else:
        # Direct distillation pipeline (recommended)
        scaler_path = os.path.join(
            os.path.dirname(model_path),
            f"{model_name}_scaler.json",
        )
        export_direct_tflite(
            model_path,
            tflite_path,
            scaler_path=scaler_path if os.path.exists(scaler_path) else None,
            num_features=num_features,
            num_classes=num_classes,
            quantize=quantize,
        )
        paths["tflite"] = tflite_path

    return paths


# ─── CLI Entry Point ─────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Export XGBoost Activity Classifier to TFLite"
    )
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        help="Path to trained XGBoost model (.json or .xgb)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="../models",
        help="Output directory for exported models",
    )
    parser.add_argument(
        "--name",
        type=str,
        default="activity_classifier",
        help="Base name for output files",
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Apply dynamic range quantization",
    )
    parser.add_argument(
        "--use-onnx",
        action="store_true",
        help="Use ONNX pipeline instead of distillation (requires onnxmltools)",
    )

    args = parser.parse_args()

    print(f"\n{'='*60}")
    print("  TrekTrack AI — Model Export Pipeline")
    print(f"{'='*60}")
    print(f"  Model:    {args.model}")
    print(f"  Output:   {args.output_dir}")
    print(f"  Quantize: {args.quantize}")
    print(f"  Method:   {'ONNX' if args.use_onnx else 'Distillation'}")
    print()

    paths = full_export_pipeline(
        model_path=args.model,
        output_dir=args.output_dir,
        model_name=args.name,
        quantize=args.quantize,
        use_onnx=args.use_onnx,
    )

    print(f"\n{'='*60}")
    print("  ✅ Export complete! Files:")
    for name, path in paths.items():
        size = os.path.getsize(path) if os.path.isfile(path) else 0
        print(f"     {name}: {path} ({size/1024:.1f} KB)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
