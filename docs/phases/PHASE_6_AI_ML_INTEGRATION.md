# Phase 6: AI/ML Integration

## Phase Title

**AI/ML Integration — Kalman Filter, Activity Classification, Terrain Analytics, and GAP Estimation**

---

## Objective

Integrate all AI and machine learning components: on-device Kalman filter for GPS noise reduction, XGBoost-based activity classification (training pipeline + TFLite inference), terrain difficulty analytics, Grade Adjusted Pace (GAP) computation, and a backend inference endpoint for advanced predictions. After this phase, the system intelligently smooths GPS tracks, auto-detects activity type, rates terrain difficulty, and computes hiking-adjusted pace.

---

## Features Implemented in This Phase

- Extended Kalman Filter (EKF) for real-time GPS smoothing on-device
- Activity classification model training (XGBoost) on backend with labeled data
- TensorFlow Lite model export and on-device inference (React Native)
- Core ML model generation for iOS
- Feature extraction pipeline (speed variance, altitude delta, step frequency proxy)
- Terrain difficulty scoring algorithm
- Grade Adjusted Pace (GAP) computation
- Backend `/ml/predict` inference endpoint (for devices that prefer server-side)
- Model versioning and OTA model update mechanism

---

## Tasks Breakdown

* Task 1: Implement Extended Kalman Filter module (TypeScript, on-device)
* Task 2: Integrate EKF into TrekRecorder pipeline (filter every GPS reading)
* Task 3: Write labeled training data loader (CSV from historical sessions)
* Task 4: Build feature extraction pipeline (Python) — 15 features per window
* Task 5: Train XGBoost activity classifier (5 classes: TREKKING, RUNNING, CYCLING, WALKING, IDLE)
* Task 6: Export model to TensorFlow Lite (`.tflite`) and Core ML (`.mlmodel`)
* Task 7: Integrate TFLite inference in React Native (android) and Core ML (iOS)
* Task 8: Implement sliding-window feature extraction on-device
* Task 9: Implement terrain difficulty scoring service (backend)
* Task 10: Implement Grade Adjusted Pace (GAP) calculator (backend + mobile)
* Task 11: Build `POST /ml/predict` backend endpoint for server-side inference
* Task 12: Build model versioning and OTA update endpoint
* Task 13: Write tests for Kalman filter, feature extraction, and classification accuracy

---

## File Structure for This Phase

```
ml/
├── data/
│   ├── raw/                              # Raw labeled CSV datasets
│   └── processed/                        # Feature-engineered datasets
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   └── 03_model_training.ipynb
├── training/
│   ├── feature_extractor.py              # Window-based feature extraction
│   ├── train_xgboost.py                  # XGBoost training + hyperparameter tuning
│   ├── evaluate.py                       # Confusion matrix, accuracy, F1
│   └── export_tflite.py                  # Convert XGBoost → ONNX → TFLite
├── models/
│   ├── activity_classifier_v1.tflite     # TFLite model output
│   ├── activity_classifier_v1.mlmodel    # Core ML model output
│   └── model_metadata.json              # Version, accuracy, feature list
├── requirements.txt

backend/app/
├── services/
│   ├── ml_inference_service.py           # Load TFLite model, run server-side prediction
│   ├── terrain_service.py                # Terrain difficulty scoring
│   └── gap_service.py                    # GAP computation
├── api/
│   └── ml.py                             # /ml/predict, /ml/model-version

mobile/src/
├── services/
│   ├── ai/
│   │   ├── KalmanFilter.ts               # Extended Kalman Filter implementation
│   │   ├── ActivityClassifier.ts          # TFLite/CoreML inference wrapper
│   │   ├── FeatureExtractor.ts            # On-device sliding-window features
│   │   └── GAPCalculator.ts               # Grade Adjusted Pace
│   └── tracking/
│       └── TrekStatsEngine.ts             # Updated: pipe through EKF + classify
└── assets/
    └── models/
        └── activity_classifier_v1.tflite  # Bundled model
```

---

## Implementation Guide

### Task 1 — Extended Kalman Filter (On-Device)

`mobile/src/services/ai/KalmanFilter.ts`:

```typescript
/**
 * 2D Extended Kalman Filter for GPS noise reduction.
 *
 * State vector: [lat, lon, vLat, vLon]
 * Measurement: [lat, lon]
 *
 * Uses a constant-velocity motion model with GPS accuracy as measurement noise.
 */

type Matrix = number[][];

export class KalmanFilter {
  private state: number[];       // [lat, lon, vLat, vLon]
  private P: Matrix;             // 4x4 covariance
  private Q: Matrix;             // Process noise
  private initialized = false;
  private lastTimestamp = 0;

  constructor(processNoise = 1e-5) {
    this.state = [0, 0, 0, 0];
    this.P = identity(4);
    this.Q = scalarMul(identity(4), processNoise);
  }

  update(lat: number, lon: number, accuracy: number, timestamp: number): { lat: number; lon: number } {
    if (!this.initialized) {
      this.state = [lat, lon, 0, 0];
      this.P = scalarMul(identity(4), accuracy * 1e-5);
      this.initialized = true;
      this.lastTimestamp = timestamp;
      return { lat, lon };
    }

    const dt = (timestamp - this.lastTimestamp) / 1000; // seconds
    this.lastTimestamp = timestamp;

    if (dt <= 0 || dt > 60) {
      // Reset on large gap
      this.state = [lat, lon, 0, 0];
      return { lat, lon };
    }

    // Predict step
    const F: Matrix = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    const predictedState = matVecMul(F, this.state);
    const predictedP = matAdd(matMul(matMul(F, this.P), transpose(F)), this.Q);

    // Measurement update
    const H: Matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];

    // Measurement noise proportional to GPS accuracy
    const R_val = accuracy * 1e-5;
    const R: Matrix = [
      [R_val, 0],
      [0, R_val],
    ];

    const z = [lat, lon];
    const y = vecSub(z, matVecMul(H, predictedState)); // innovation

    const S = matAdd(matMul(matMul(H, predictedP), transpose(H)), R);
    const K = matMul(matMul(predictedP, transpose(H)), invert2x2(S));

    this.state = vecAdd(predictedState, matVecMul(K, y));
    this.P = matMul(matSub(identity(4), matMul(K, H)), predictedP);

    return { lat: this.state[0], lon: this.state[1] };
  }

  reset(): void {
    this.initialized = false;
    this.state = [0, 0, 0, 0];
    this.P = identity(4);
  }
}

// ---- Minimal linear algebra helpers ----

function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

function scalarMul(m: Matrix, s: number): Matrix {
  return m.map((row) => row.map((v) => v * s));
}

function matMul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length, cols = b[0].length, inner = b.length;
  const result: Matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        result[i][j] += a[i][k] * b[k][j];
  return result;
}

function matAdd(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

function matSub(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

function transpose(m: Matrix): Matrix {
  return m[0].map((_, j) => m.map((row) => row[j]));
}

function matVecMul(m: Matrix, v: number[]): number[] {
  return m.map((row) => row.reduce((sum, val, j) => sum + val * v[j], 0));
}

function vecAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function vecSub(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

function invert2x2(m: Matrix): Matrix {
  const [[a, b], [c, d]] = m;
  const det = a * d - b * c;
  return [
    [d / det, -b / det],
    [-c / det, a / det],
  ];
}
```

### Task 4 — Feature Extraction Pipeline (Python)

`ml/training/feature_extractor.py`:

```python
"""Sliding-window feature extraction for activity classification.

Takes a window of GPS readings (e.g. 30 seconds at 1 Hz = 30 points)
and extracts 15 features for each window.
"""
import math
from typing import Any

import numpy as np


def extract_features(window: list[dict[str, Any]]) -> dict[str, float]:
    speeds = [p.get("speed", 0) or 0 for p in window]
    altitudes = [p.get("altitude", 0) or 0 for p in window]
    headings = [p.get("heading", 0) or 0 for p in window]
    accuracies = [p.get("accuracy", 10) for p in window]

    # Speed features
    speed_arr = np.array(speeds)
    alt_arr = np.array(altitudes)
    heading_arr = np.array(headings)

    # Altitude deltas
    alt_deltas = np.diff(alt_arr)

    # Heading changes
    heading_changes = np.abs(np.diff(heading_arr))
    heading_changes = np.where(heading_changes > 180, 360 - heading_changes, heading_changes)

    return {
        "speed_mean": float(np.mean(speed_arr)),
        "speed_std": float(np.std(speed_arr)),
        "speed_max": float(np.max(speed_arr)),
        "speed_min": float(np.min(speed_arr)),
        "speed_range": float(np.ptp(speed_arr)),
        "altitude_mean": float(np.mean(alt_arr)),
        "altitude_std": float(np.std(alt_arr)),
        "altitude_delta_total": float(np.sum(np.abs(alt_deltas))),
        "altitude_gain": float(np.sum(alt_deltas[alt_deltas > 0])),
        "altitude_loss": float(np.sum(np.abs(alt_deltas[alt_deltas < 0]))),
        "heading_change_mean": float(np.mean(heading_changes)) if len(heading_changes) > 0 else 0,
        "heading_change_std": float(np.std(heading_changes)) if len(heading_changes) > 0 else 0,
        "accuracy_mean": float(np.mean(accuracies)),
        "num_points": len(window),
        "duration_s": (window[-1]["timestamp"] - window[0]["timestamp"]) / 1000 if len(window) > 1 else 0,
    }


FEATURE_NAMES = [
    "speed_mean", "speed_std", "speed_max", "speed_min", "speed_range",
    "altitude_mean", "altitude_std", "altitude_delta_total",
    "altitude_gain", "altitude_loss",
    "heading_change_mean", "heading_change_std",
    "accuracy_mean", "num_points", "duration_s",
]

ACTIVITY_LABELS = {0: "IDLE", 1: "WALKING", 2: "TREKKING", 3: "RUNNING", 4: "CYCLING"}
```

### Task 5 — XGBoost Training

`ml/training/train_xgboost.py`:

```python
"""Train XGBoost activity classifier."""
import json
import pickle

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from feature_extractor import ACTIVITY_LABELS, FEATURE_NAMES


def train(data_path: str, output_dir: str = "../models"):
    df = pd.read_csv(data_path)
    X = df[FEATURE_NAMES].values
    y = df["label"].values  # 0-4

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=5,
        eval_metric="mlogloss",
        use_label_encoder=False,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=True)

    y_pred = model.predict(X_test)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=list(ACTIVITY_LABELS.values())))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Save
    model.save_model(f"{output_dir}/activity_classifier_v1.json")
    with open(f"{output_dir}/activity_classifier_v1.pkl", "wb") as f:
        pickle.dump(model, f)

    accuracy = float(np.mean(y_pred == y_test))
    metadata = {
        "version": "1.0.0",
        "model_type": "xgboost",
        "num_classes": 5,
        "labels": ACTIVITY_LABELS,
        "features": FEATURE_NAMES,
        "accuracy": round(accuracy, 4),
    }
    with open(f"{output_dir}/model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n✓ Model saved — accuracy: {accuracy:.2%}")


if __name__ == "__main__":
    train("../data/processed/training_data.csv")
```

### Task 6 — Export to TFLite

`ml/training/export_tflite.py`:

```python
"""Export XGBoost model to TensorFlow Lite via ONNX."""
import numpy as np
import onnxmltools
import onnxruntime as ort
import tensorflow as tf
from onnxmltools.convert.common.data_types import FloatTensorType
from xgboost import XGBClassifier


def export(model_path: str = "../models/activity_classifier_v1.json", output: str = "../models/activity_classifier_v1.tflite"):
    model = XGBClassifier()
    model.load_model(model_path)

    # XGBoost → ONNX
    initial_types = [("features", FloatTensorType([None, 15]))]
    onnx_model = onnxmltools.convert_xgboost(model, initial_types=initial_types)
    onnx_path = model_path.replace(".json", ".onnx")
    onnxmltools.utils.save_model(onnx_model, onnx_path)

    # Verify ONNX
    session = ort.InferenceSession(onnx_path)
    dummy = np.random.randn(1, 15).astype(np.float32)
    onnx_pred = session.run(None, {"features": dummy})
    print(f"ONNX output shape: {onnx_pred[0].shape}")

    # ONNX → TF Saved Model → TFLite
    # (Use onnx-tf or tf2onnx for the conversion)
    import onnx
    from onnx_tf.backend import prepare

    onnx_model = onnx.load(onnx_path)
    tf_rep = prepare(onnx_model)
    tf_rep.export_graph(model_path.replace(".json", "_tf"))

    converter = tf.lite.TFLiteConverter.from_saved_model(model_path.replace(".json", "_tf"))
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()

    with open(output, "wb") as f:
        f.write(tflite_model)

    print(f"✓ TFLite model saved to {output} ({len(tflite_model)} bytes)")


if __name__ == "__main__":
    export()
```

### Task 9 — Terrain Difficulty Scoring

`backend/app/services/terrain_service.py`:

```python
"""Terrain difficulty scoring based on grade distribution, exposure, and distance."""
import math
from typing import Any


def compute_terrain_score(points: list[dict[str, Any]]) -> dict[str, Any]:
    """Score terrain difficulty on a 1-10 scale with breakdown."""
    if len(points) < 2:
        return {"score": 1, "grade": "Easy", "factors": {}}

    grades = []
    for i in range(1, len(points)):
        p1, p2 = points[i - 1], points[i]
        alt1, alt2 = (p1.get("altitude") or 0), (p2.get("altitude") or 0)

        # Horizontal distance
        lat1, lon1 = math.radians(p1["latitude"]), math.radians(p1["longitude"])
        lat2, lon2 = math.radians(p2["latitude"]), math.radians(p2["longitude"])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        horiz = 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        if horiz > 1:  # Avoid near-zero division
            grade_pct = ((alt2 - alt1) / horiz) * 100
            grades.append(grade_pct)

    if not grades:
        return {"score": 1, "grade": "Easy", "factors": {}}

    import numpy as np
    arr = np.array(grades)
    avg_grade = float(np.mean(np.abs(arr)))
    max_grade = float(np.max(np.abs(arr)))
    steep_pct = float(np.mean(np.abs(arr) > 15)) * 100  # % of segments > 15% grade

    # Scoring formula
    grade_score = min(avg_grade / 5, 4)                   # 0-4 points
    steep_score = min(steep_pct / 25, 3)                   # 0-3 points
    max_score = min(max_grade / 20, 3)                     # 0-3 points
    total = round(grade_score + steep_score + max_score, 1)
    total = max(1, min(10, total))

    if total <= 3:
        grade = "Easy"
    elif total <= 5:
        grade = "Moderate"
    elif total <= 7:
        grade = "Hard"
    else:
        grade = "Expert"

    return {
        "score": total,
        "grade": grade,
        "factors": {
            "avg_grade_pct": round(avg_grade, 1),
            "max_grade_pct": round(max_grade, 1),
            "steep_segment_pct": round(steep_pct, 1),
        },
    }
```

### Task 10 — Grade Adjusted Pace (GAP)

`backend/app/services/gap_service.py`:

```python
"""Grade Adjusted Pace (GAP) — adjusts actual pace for gradient.

Uses Minetti's metabolic cost of locomotion formula (2002):
  Cost = 155.4 * i^5 - 30.4 * i^4 - 43.3 * i^3 + 46.3 * i^2 + 19.5 * i + 3.6
  where i = slope as a fraction (rise/run).

GAP = Actual_Pace * (cost_at_0_grade / cost_at_slope)
"""
import math


def _metabolic_cost(slope: float) -> float:
    """Return relative metabolic cost at a given slope fraction."""
    i = slope
    cost = 155.4 * i**5 - 30.4 * i**4 - 43.3 * i**3 + 46.3 * i**2 + 19.5 * i + 3.6
    return max(cost, 0.1)  # floor to avoid division issues


FLAT_COST = _metabolic_cost(0.0)  # ~3.6


def gap_speed(actual_speed_ms: float, slope_fraction: float) -> float:
    """Return GAP-adjusted speed in m/s."""
    if actual_speed_ms <= 0:
        return 0.0
    cost = _metabolic_cost(slope_fraction)
    return actual_speed_ms * (cost / FLAT_COST)


def compute_gap_for_session(points: list[dict]) -> dict:
    """Compute average GAP for an entire session of GPS points.

    Returns dict with gap_speed_kmh, gap_pace_min_km, total_gap_distance_m.
    """
    if len(points) < 2:
        return {"gap_speed_kmh": 0, "gap_pace_min_km": 0, "total_gap_distance_m": 0}

    total_gap_distance = 0.0
    total_time = 0.0

    for i in range(1, len(points)):
        p1, p2 = points[i - 1], points[i]
        dt = (p2["time"] - p1["time"]).total_seconds()
        if dt <= 0:
            continue

        alt1 = p1.get("altitude") or 0
        alt2 = p2.get("altitude") or 0

        # Approximate horizontal distance
        from app.utils.distance import haversine_2d
        horiz = haversine_2d(p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"])
        slope = (alt2 - alt1) / horiz if horiz > 1 else 0

        actual_speed = horiz / dt
        adj_speed = gap_speed(actual_speed, slope)
        total_gap_distance += adj_speed * dt
        total_time += dt

    gap_speed_ms = total_gap_distance / total_time if total_time > 0 else 0
    gap_speed_kmh = gap_speed_ms * 3.6
    gap_pace = (1000 / gap_speed_ms / 60) if gap_speed_ms > 0 else 0

    return {
        "gap_speed_kmh": round(gap_speed_kmh, 2),
        "gap_pace_min_km": round(gap_pace, 2),
        "total_gap_distance_m": round(total_gap_distance, 2),
    }
```

### Task 11 — Backend ML Endpoint

`backend/app/api/ml.py`:

```python
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services.ml_inference_service import predict_activity

router = APIRouter(prefix="/ml", tags=["ml"])


class PredictionRequest(BaseModel):
    features: list[float]  # 15 feature values from a window


class PredictionResponse(BaseModel):
    activity: str
    confidence: float
    probabilities: dict[str, float]


@router.post("/predict", response_model=PredictionResponse)
async def predict(data: PredictionRequest, user=Depends(get_current_user)):
    return predict_activity(data.features)


@router.get("/model-version")
async def model_version():
    with open("ml/models/model_metadata.json") as f:
        return json.load(f)
```

---

## Dependencies

### ML Training (`ml/requirements.txt`)

```
xgboost==2.0.3
scikit-learn==1.4.0
pandas==2.2.0
numpy==1.26.3
onnxmltools==1.12.0
onnxruntime==1.17.0
onnx-tf==1.10.0
tensorflow==2.15.0
coremltools==7.1
```

### Backend additions

```
xgboost==2.0.3
numpy==1.26.3
```

### Mobile additions

```json
{
  "react-native-tflite": "^0.4.0"
}
```

---

## Expected Output

After completing this phase:

1. GPS readings pass through the Extended Kalman Filter before distance/speed computation — noticeable noise reduction.
2. The XGBoost model is trained on labeled data achieving ≥ 85% accuracy across 5 activity classes.
3. The TFLite model runs on-device in < 5 ms per inference, classifying activity every 30 seconds.
4. Terrain difficulty scores (1-10) with grade breakdown are computed for completed sessions.
5. GAP-adjusted pace provides meaningful comparison across flat vs hilly terrain.
6. `POST /ml/predict` allows server-side inference for devices that prefer offloading compute.

---

## Testing Instructions

### 1. Kalman Filter Unit Test

```bash
cd mobile
npx jest --testPathPattern='KalmanFilter'
```

Feed synthetic noisy GPS data (Gaussian noise σ=15m on a known straight line). Verify filtered output has RMSE < 5m.

### 2. Model Training Validation

```bash
cd ml
python training/train_xgboost.py
# Expected output: accuracy ≥ 0.85, confusion matrix printed
```

### 3. TFLite Export Verification

```bash
python training/export_tflite.py
# Expected: activity_classifier_v1.tflite created, size < 500 KB
```

### 4. Backend ML Endpoint Test

```bash
curl -X POST http://localhost:8000/ml/predict \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"features": [1.2, 0.3, 2.1, 0.4, 1.7, 550, 12.3, 45.2, 30.1, 15.1, 8.2, 3.1, 12.0, 30, 30.0]}'
# Expected: {"activity": "TREKKING", "confidence": 0.87, "probabilities": {...}}
```

### 5. Terrain Scoring Test

```bash
cd backend
pytest tests/test_terrain.py -v
# Flat route → score 1-3 (Easy)
# Mountain route → score 7-10 (Expert)
```
