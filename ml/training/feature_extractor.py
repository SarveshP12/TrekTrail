"""
feature_extractor.py — Sliding-Window Feature Extraction for Activity Classification

Extracts statistical features from raw GPS + sensor windows for the
TrekTrack AI activity classifier (TREKKING, RUNNING, CYCLING, WALKING, IDLE).

Each GPS reading contains:
    timestamp (ms), latitude, longitude, altitude, accuracy, speed, heading

Features are computed over a configurable sliding window (default 5s / 5 readings at 1Hz).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

# ─── Activity Labels ──────────────────────────────────────────────────────────

ACTIVITY_LABELS = ["IDLE", "WALKING", "TREKKING", "RUNNING", "CYCLING"]
LABEL_TO_ID = {label: idx for idx, label in enumerate(ACTIVITY_LABELS)}
ID_TO_LABEL = {idx: label for idx, label in enumerate(ACTIVITY_LABELS)}
NUM_CLASSES = len(ACTIVITY_LABELS)


# ─── Constants ────────────────────────────────────────────────────────────────

EARTH_RADIUS_M = 6_371_000
DEFAULT_WINDOW_SIZE = 5  # number of readings per window
DEFAULT_STEP_SIZE = 1  # slide by 1 reading
METERS_PER_DEG_LAT = 111_320


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two WGS84 points."""
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Feature Names (must match the on-device FeatureExtractor order) ──────────

FEATURE_NAMES = [
    # Speed features
    "speed_mean",
    "speed_std",
    "speed_max",
    "speed_min",
    "speed_range",
    # Distance features
    "total_distance",
    "displacement",
    "sinuosity",  # total_distance / displacement (straightness)
    # Altitude features
    "altitude_mean",
    "altitude_std",
    "altitude_delta",  # last - first altitude in window
    "altitude_gain",
    "altitude_loss",
    # Heading features
    "heading_mean_sin",  # circular mean via sin/cos
    "heading_mean_cos",
    "heading_std",
    # Acceleration proxy (speed change rate)
    "acceleration_mean",
    "acceleration_std",
    # Temporal
    "window_duration_s",
    # Step frequency proxy (speed oscillation zero-crossings)
    "speed_zero_crossings",
]

NUM_FEATURES = len(FEATURE_NAMES)


# ─── Feature Extraction ──────────────────────────────────────────────────────


@dataclass
class GPSPoint:
    timestamp: float  # seconds since epoch
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: float = 10.0
    speed: Optional[float] = None
    heading: Optional[float] = None


def extract_window_features(points: list[GPSPoint]) -> np.ndarray:
    """
    Extract a feature vector from a window of GPS points.

    Args:
        points: List of GPSPoint in chronological order (min 2 points).

    Returns:
        1D numpy array of shape (NUM_FEATURES,)
    """
    n = len(points)
    assert n >= 2, f"Need at least 2 points, got {n}"

    # ── Speed ──
    speeds = np.array([p.speed if p.speed is not None else 0.0 for p in points])
    speed_mean = float(np.mean(speeds))
    speed_std = float(np.std(speeds))
    speed_max = float(np.max(speeds))
    speed_min = float(np.min(speeds))
    speed_range = speed_max - speed_min

    # ── Distances between consecutive points ──
    segment_dists: list[float] = []
    for i in range(1, n):
        d = _haversine(
            points[i - 1].latitude,
            points[i - 1].longitude,
            points[i].latitude,
            points[i].longitude,
        )
        segment_dists.append(d)

    total_distance = sum(segment_dists)

    # Displacement: straight-line distance from first to last
    displacement = _haversine(
        points[0].latitude,
        points[0].longitude,
        points[-1].latitude,
        points[-1].longitude,
    )

    # Sinuosity = total_distance / displacement (1.0 = perfectly straight)
    sinuosity = total_distance / max(displacement, 0.01)

    # ── Altitude ──
    altitudes = np.array(
        [p.altitude if p.altitude is not None else 0.0 for p in points]
    )
    altitude_mean = float(np.mean(altitudes))
    altitude_std = float(np.std(altitudes))
    altitude_delta = float(altitudes[-1] - altitudes[0])

    altitude_gain = 0.0
    altitude_loss = 0.0
    for i in range(1, n):
        diff = altitudes[i] - altitudes[i - 1]
        if diff > 0:
            altitude_gain += diff
        else:
            altitude_loss += abs(diff)

    # ── Heading (circular statistics) ──
    headings_rad = np.array(
        [math.radians(p.heading) if p.heading is not None else 0.0 for p in points]
    )
    heading_mean_sin = float(np.mean(np.sin(headings_rad)))
    heading_mean_cos = float(np.mean(np.cos(headings_rad)))

    # Circular std: 1 - R  where R = sqrt(sin_mean² + cos_mean²)
    R = math.sqrt(heading_mean_sin**2 + heading_mean_cos**2)
    heading_std = float(1.0 - R)

    # ── Acceleration proxy (speed change / dt) ──
    accelerations: list[float] = []
    for i in range(1, n):
        dt = points[i].timestamp - points[i - 1].timestamp
        if dt > 0:
            dv = speeds[i] - speeds[i - 1]
            accelerations.append(dv / dt)
    if accelerations:
        acc_arr = np.array(accelerations)
        acceleration_mean = float(np.mean(acc_arr))
        acceleration_std = float(np.std(acc_arr))
    else:
        acceleration_mean = 0.0
        acceleration_std = 0.0

    # ── Temporal ──
    window_duration_s = float(points[-1].timestamp - points[0].timestamp)

    # ── Speed zero-crossings (proxy for step frequency) ──
    # Count how many times speed crosses the mean
    speed_detrended = speeds - speed_mean
    zero_crossings = 0
    for i in range(1, n):
        if speed_detrended[i - 1] * speed_detrended[i] < 0:
            zero_crossings += 1

    return np.array(
        [
            speed_mean,
            speed_std,
            speed_max,
            speed_min,
            speed_range,
            total_distance,
            displacement,
            sinuosity,
            altitude_mean,
            altitude_std,
            altitude_delta,
            altitude_gain,
            altitude_loss,
            heading_mean_sin,
            heading_mean_cos,
            heading_std,
            acceleration_mean,
            acceleration_std,
            window_duration_s,
            float(zero_crossings),
        ],
        dtype=np.float32,
    )


# ─── Dataset Builder ──────────────────────────────────────────────────────────


def build_dataset_from_csv(
    csv_path: str,
    window_size: int = DEFAULT_WINDOW_SIZE,
    step_size: int = DEFAULT_STEP_SIZE,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Build feature matrix (X) and label vector (y) from a labeled CSV.

    Expected CSV columns:
        timestamp, latitude, longitude, altitude, accuracy, speed, heading, label

    Where `label` is one of ACTIVITY_LABELS.

    Returns:
        (X, y) where X has shape (num_windows, NUM_FEATURES) and y has shape (num_windows,)
    """
    df = pd.read_csv(csv_path)

    required_cols = {"timestamp", "latitude", "longitude", "label"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")

    X_list: list[np.ndarray] = []
    y_list: list[int] = []

    for start_idx in range(0, len(df) - window_size + 1, step_size):
        window_df = df.iloc[start_idx : start_idx + window_size]

        # Determine label by majority vote
        labels = window_df["label"].values
        unique, counts = np.unique(labels, return_counts=True)
        majority_label = unique[np.argmax(counts)]

        if majority_label not in LABEL_TO_ID:
            continue  # skip unknown labels

        # Build GPS points
        points = [
            GPSPoint(
                timestamp=row.get("timestamp", i),
                latitude=row["latitude"],
                longitude=row["longitude"],
                altitude=row.get("altitude"),
                accuracy=row.get("accuracy", 10.0),
                speed=row.get("speed"),
                heading=row.get("heading"),
            )
            for i, (_, row) in enumerate(window_df.iterrows())
        ]

        features = extract_window_features(points)
        X_list.append(features)
        y_list.append(LABEL_TO_ID[majority_label])

    X = np.vstack(X_list) if X_list else np.empty((0, NUM_FEATURES), dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)

    return X, y


def generate_synthetic_dataset(
    num_samples_per_class: int = 500,
    window_size: int = DEFAULT_WINDOW_SIZE,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate a synthetic training dataset for development/testing.
    Simulates realistic GPS patterns for each activity type.

    Returns:
        (X, y) — feature matrix and label vector
    """
    rng = np.random.RandomState(seed)
    X_list: list[np.ndarray] = []
    y_list: list[int] = []

    # Activity-specific speed profiles (m/s): (mean, std)
    speed_profiles = {
        "IDLE": (0.0, 0.05),
        "WALKING": (1.3, 0.3),
        "TREKKING": (1.0, 0.4),
        "RUNNING": (3.0, 0.6),
        "CYCLING": (5.5, 1.2),
    }

    # Altitude change profiles (m per step): (mean_delta, std_delta)
    altitude_profiles = {
        "IDLE": (0.0, 0.2),
        "WALKING": (0.0, 0.5),
        "TREKKING": (0.5, 1.5),  # uphill bias
        "RUNNING": (0.0, 0.3),
        "CYCLING": (0.0, 0.8),
    }

    # Heading variance (radians std)
    heading_var = {
        "IDLE": 1.5,  # random jitter
        "WALKING": 0.3,
        "TREKKING": 0.5,  # trail turns
        "RUNNING": 0.2,  # relatively straight
        "CYCLING": 0.15,  # very straight
    }

    for label in ACTIVITY_LABELS:
        label_id = LABEL_TO_ID[label]
        sp_mean, sp_std = speed_profiles[label]
        alt_mean, alt_std = altitude_profiles[label]
        h_var = heading_var[label]

        for _ in range(num_samples_per_class):
            # Generate a window of GPS points
            start_lat = rng.uniform(-60, 60)
            start_lon = rng.uniform(-180, 180)
            start_alt = rng.uniform(0, 2000)
            base_heading = rng.uniform(0, 360)

            points: list[GPSPoint] = []
            lat, lon, alt = start_lat, start_lon, start_alt
            heading = base_heading

            for t in range(window_size):
                speed = max(0.0, rng.normal(sp_mean, sp_std))
                heading = (heading + rng.normal(0, math.degrees(h_var))) % 360
                alt_delta = rng.normal(alt_mean, alt_std)

                # Move position based on speed and heading
                dt = 1.0  # 1 second
                bearing_rad = math.radians(heading)
                distance_m = speed * dt
                dlat = (distance_m * math.cos(bearing_rad)) / METERS_PER_DEG_LAT
                dlon = (distance_m * math.sin(bearing_rad)) / (
                    METERS_PER_DEG_LAT * max(math.cos(math.radians(lat)), 0.01)
                )

                lat += dlat
                lon += dlon
                alt += alt_delta

                points.append(
                    GPSPoint(
                        timestamp=float(t),
                        latitude=lat,
                        longitude=lon,
                        altitude=alt,
                        accuracy=rng.uniform(3, 15),
                        speed=speed,
                        heading=heading,
                    )
                )

            features = extract_window_features(points)
            X_list.append(features)
            y_list.append(label_id)

    X = np.vstack(X_list)
    y = np.array(y_list, dtype=np.int32)

    # Shuffle
    perm = rng.permutation(len(y))
    return X[perm], y[perm]


# ─── CLI Entry Point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Feature Extractor for TrekTrack AI")
    parser.add_argument("--csv", type=str, help="Path to labeled GPS CSV file")
    parser.add_argument(
        "--synthetic", action="store_true", help="Generate synthetic dataset"
    )
    parser.add_argument(
        "--samples", type=int, default=500, help="Samples per class for synthetic data"
    )
    parser.add_argument(
        "--window", type=int, default=DEFAULT_WINDOW_SIZE, help="Window size"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="../data",
        help="Output directory for .npz files",
    )
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    if args.synthetic:
        print(
            f"Generating synthetic dataset ({args.samples} samples/class, window={args.window})..."
        )
        X, y = generate_synthetic_dataset(
            num_samples_per_class=args.samples,
            window_size=args.window,
        )
    elif args.csv:
        print(f"Extracting features from {args.csv} (window={args.window})...")
        X, y = build_dataset_from_csv(args.csv, window_size=args.window)
    else:
        parser.error("Specify --csv or --synthetic")

    out_path = os.path.join(args.output_dir, "activity_features.npz")
    np.savez_compressed(out_path, X=X, y=y, feature_names=FEATURE_NAMES)
    print(f"Saved {X.shape[0]} samples × {X.shape[1]} features to {out_path}")
    print(f"Class distribution: {dict(zip(*np.unique(y, return_counts=True)))}")
