"""
train_xgboost.py — XGBoost Activity Classifier Training Pipeline

Trains a multi-class XGBoost model on GPS-derived features to classify
activity types: IDLE, WALKING, TREKKING, RUNNING, CYCLING.

Usage:
    # Train on synthetic data (for development)
    python train_xgboost.py --synthetic --samples 1000

    # Train on real extracted features
    python train_xgboost.py --data ../data/activity_features.npz

    # Full pipeline: extract → train → evaluate
    python train_xgboost.py --synthetic --samples 2000 --output-dir ../models
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler

from feature_extractor import (
    ACTIVITY_LABELS,
    FEATURE_NAMES,
    ID_TO_LABEL,
    NUM_CLASSES,
    NUM_FEATURES,
    generate_synthetic_dataset,
)

# ─── Default Hyperparameters ─────────────────────────────────────────────────

DEFAULT_PARAMS: dict[str, Any] = {
    "objective": "multi:softprob",
    "num_class": NUM_CLASSES,
    "eval_metric": "mlogloss",
    "max_depth": 6,
    "learning_rate": 0.1,
    "n_estimators": 200,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 3,
    "gamma": 0.1,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "tree_method": "hist",  # fast histogram-based method
    "random_state": 42,
    "verbosity": 1,
}


# ─── Training Pipeline ───────────────────────────────────────────────────────


class ActivityClassifierTrainer:
    """End-to-end training pipeline for the activity classifier."""

    def __init__(
        self,
        params: dict[str, Any] | None = None,
        output_dir: str = "../models",
        test_size: float = 0.2,
        n_cv_folds: int = 5,
    ):
        self.params = {**DEFAULT_PARAMS, **(params or {})}
        self.output_dir = output_dir
        self.test_size = test_size
        self.n_cv_folds = n_cv_folds

        self.model: xgb.XGBClassifier | None = None
        self.scaler: StandardScaler | None = None
        self.metadata: dict[str, Any] = {}

    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        run_cv: bool = True,
    ) -> dict[str, Any]:
        """
        Train the XGBoost classifier.

        Args:
            X: Feature matrix (num_samples, NUM_FEATURES)
            y: Label vector (num_samples,)
            run_cv: Whether to run cross-validation

        Returns:
            Dictionary of training results and metrics.
        """
        print(f"\n{'='*60}")
        print(f"  TrekTrack AI — Activity Classifier Training")
        print(f"{'='*60}")
        print(f"  Samples: {X.shape[0]}, Features: {X.shape[1]}")
        print(f"  Classes: {NUM_CLASSES} ({', '.join(ACTIVITY_LABELS)})")

        # ── Class distribution ──
        unique, counts = np.unique(y, return_counts=True)
        print(f"\n  Class distribution:")
        for cls_id, count in zip(unique, counts):
            print(
                f"    {ID_TO_LABEL[cls_id]:>10}: {count:>5} ({count/len(y)*100:.1f}%)"
            )

        # ── Train/Test split ──
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=self.test_size,
            stratify=y,
            random_state=42,
        )
        print(f"\n  Train: {X_train.shape[0]}, Test: {X_test.shape[0]}")

        # ── Feature scaling ──
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # ── Cross-validation ──
        cv_scores = None
        if run_cv:
            print(f"\n  Running {self.n_cv_folds}-fold cross-validation...")
            cv_model = xgb.XGBClassifier(**self.params)
            skf = StratifiedKFold(
                n_splits=self.n_cv_folds, shuffle=True, random_state=42
            )
            cv_scores = cross_val_score(
                cv_model,
                X_train_scaled,
                y_train,
                cv=skf,
                scoring="f1_macro",
            )
            print(f"  CV F1 (macro): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

        # ── Train final model ──
        print(f"\n  Training final model...")
        start = time.time()

        self.model = xgb.XGBClassifier(**self.params)
        self.model.fit(
            X_train_scaled,
            y_train,
            eval_set=[(X_test_scaled, y_test)],
            verbose=False,
        )

        train_time = time.time() - start
        print(f"  Training completed in {train_time:.2f}s")

        # ── Evaluate ──
        y_pred = self.model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average="macro")
        conf_matrix = confusion_matrix(y_test, y_pred)
        class_report = classification_report(
            y_test,
            y_pred,
            target_names=ACTIVITY_LABELS,
            output_dict=True,
        )

        print(f"\n  Test Accuracy: {accuracy:.4f}")
        print(f"  Test F1 (macro): {f1:.4f}")
        print(f"\n  Classification Report:")
        print(classification_report(y_test, y_pred, target_names=ACTIVITY_LABELS))

        # ── Feature importance ──
        importance = self.model.feature_importances_
        importance_ranking = sorted(
            zip(FEATURE_NAMES, importance),
            key=lambda x: x[1],
            reverse=True,
        )
        print(f"  Top 10 Features:")
        for fname, imp in importance_ranking[:10]:
            bar = "█" * int(imp * 100)
            print(f"    {fname:<25} {imp:.4f} {bar}")

        # ── Build metadata ──
        self.metadata = {
            "model_type": "xgboost",
            "model_version": "1.0.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "num_features": NUM_FEATURES,
            "feature_names": FEATURE_NAMES,
            "num_classes": NUM_CLASSES,
            "class_labels": ACTIVITY_LABELS,
            "hyperparameters": {k: str(v) for k, v in self.params.items()},
            "training": {
                "total_samples": int(X.shape[0]),
                "train_samples": int(X_train.shape[0]),
                "test_samples": int(X_test.shape[0]),
                "training_time_s": round(train_time, 2),
            },
            "metrics": {
                "test_accuracy": round(float(accuracy), 4),
                "test_f1_macro": round(float(f1), 4),
                "cv_f1_mean": (
                    round(float(cv_scores.mean()), 4) if cv_scores is not None else None
                ),
                "cv_f1_std": (
                    round(float(cv_scores.std()), 4) if cv_scores is not None else None
                ),
            },
            "feature_importance": {
                fname: round(float(imp), 4) for fname, imp in importance_ranking
            },
            "scaler": {
                "mean": self.scaler.mean_.tolist(),
                "scale": self.scaler.scale_.tolist(),
            },
        }

        return self.metadata

    def save(self, model_name: str = "activity_classifier") -> dict[str, str]:
        """
        Save the trained model, scaler, and metadata.

        Returns:
            Dictionary of saved file paths.
        """
        if self.model is None:
            raise RuntimeError("No trained model. Call train() first.")

        os.makedirs(self.output_dir, exist_ok=True)

        paths: dict[str, str] = {}

        # Save XGBoost native model (for ONNX export)
        xgb_path = os.path.join(self.output_dir, f"{model_name}.xgb")
        self.model.save_model(xgb_path)
        paths["xgboost"] = xgb_path
        print(f"  Saved XGBoost model: {xgb_path}")

        # Save JSON model (portable format)
        json_path = os.path.join(self.output_dir, f"{model_name}.json")
        self.model.save_model(json_path)
        paths["json"] = json_path
        print(f"  Saved JSON model: {json_path}")

        # Save scaler parameters (needed for on-device inference)
        scaler_path = os.path.join(self.output_dir, f"{model_name}_scaler.json")
        scaler_data = {
            "mean": self.scaler.mean_.tolist(),
            "scale": self.scaler.scale_.tolist(),
            "feature_names": FEATURE_NAMES,
        }
        with open(scaler_path, "w") as f:
            json.dump(scaler_data, f, indent=2)
        paths["scaler"] = scaler_path
        print(f"  Saved scaler: {scaler_path}")

        # Save metadata
        meta_path = os.path.join(self.output_dir, f"{model_name}_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(self.metadata, f, indent=2)
        paths["metadata"] = meta_path
        print(f"  Saved metadata: {meta_path}")

        return paths


# ─── CLI Entry Point ─────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Train TrekTrack AI Activity Classifier"
    )
    parser.add_argument("--data", type=str, help="Path to .npz feature file")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic data")
    parser.add_argument(
        "--samples", type=int, default=1000, help="Samples per class (synthetic)"
    )
    parser.add_argument(
        "--output-dir", type=str, default="../models", help="Output directory"
    )
    parser.add_argument("--no-cv", action="store_true", help="Skip cross-validation")
    parser.add_argument("--max-depth", type=int, default=6, help="XGBoost max_depth")
    parser.add_argument(
        "--n-estimators", type=int, default=200, help="Number of boosting rounds"
    )
    parser.add_argument("--lr", type=float, default=0.1, help="Learning rate")

    args = parser.parse_args()

    # Load or generate data
    if args.synthetic:
        print(f"Generating synthetic dataset ({args.samples} samples/class)...")
        X, y = generate_synthetic_dataset(num_samples_per_class=args.samples)
    elif args.data:
        print(f"Loading features from {args.data}...")
        data = np.load(args.data)
        X, y = data["X"], data["y"]
    else:
        parser.error("Specify --data or --synthetic")

    # Configure hyperparameters
    params = {
        "max_depth": args.max_depth,
        "n_estimators": args.n_estimators,
        "learning_rate": args.lr,
    }

    # Train
    trainer = ActivityClassifierTrainer(
        params=params,
        output_dir=args.output_dir,
    )
    trainer.train(X, y, run_cv=not args.no_cv)

    # Save
    print(f"\n  Saving model artifacts to {args.output_dir}...")
    paths = trainer.save()
    print(f"\n{'='*60}")
    print(f"  ✅ Training complete! Files:")
    for name, path in paths.items():
        print(f"     {name}: {path}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
