"""
ml.py — ML Inference & Analytics API Endpoints

Exposes:
  POST /ml/predict           — Server-side activity classification
  POST /ml/gap               — Grade Adjusted Pace calculation
  POST /ml/terrain            — Terrain difficulty scoring
  GET  /ml/model/info         — Current model version & metadata
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_ts_db
from app.services.gap_service import (
    GPSSegment,
    GAPResult,
    SessionGAPSummary,
    compute_segment_gap,
    compute_session_gap,
    gps_points_to_segments,
)
from app.services.gps_service import get_session_points
from app.services.ml_inference_service import ml_inference_service
from app.services.terrain_service import (
    TerrainDifficultyResult,
    compute_terrain_difficulty,
    compute_terrain_difficulty_from_points,
)

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

# -- Predict --

class GPSPointInput(BaseModel):
    timestamp: float = Field(..., description="Timestamp in seconds since epoch")
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: float = 10.0
    speed: Optional[float] = None
    heading: Optional[float] = None


class PredictRequest(BaseModel):
    """Request body for activity prediction."""
    points: list[GPSPointInput] = Field(
        ..., min_length=2,
        description="GPS points window (minimum 2, recommended 5)",
    )
    model_version: Optional[str] = Field(
        None, description="Request a specific model version",
    )


class PredictResponse(BaseModel):
    """Activity classification result."""
    predicted_label: str
    confidence: float
    probabilities: dict[str, float]
    model_version: str
    inference_time_ms: float


# -- GAP --

class GAPRequest(BaseModel):
    """Request for Grade Adjusted Pace calculation."""
    session_id: Optional[str] = Field(
        None, description="Trek session ID (loads points from DB)",
    )
    points: Optional[list[GPSPointInput]] = Field(
        None, description="GPS points (alternative to session_id)",
    )


class GAPSegmentResult(BaseModel):
    actual_pace_min_km: Optional[float]
    gap_pace_min_km: Optional[float]
    adjustment_factor: float
    gradient_pct: float
    distance_m: float
    elevation_delta_m: float


class GAPResponse(BaseModel):
    """Grade Adjusted Pace result."""
    actual_avg_pace_min_km: Optional[float]
    gap_avg_pace_min_km: Optional[float]
    total_distance_m: float
    total_elevation_gain_m: float
    total_elevation_loss_m: float
    total_time_s: float
    num_segments: int
    avg_gradient_pct: float
    segments: Optional[list[GAPSegmentResult]] = None


# -- Terrain --

class TerrainRequest(BaseModel):
    """Request for terrain difficulty scoring."""
    session_id: Optional[str] = Field(
        None, description="Trek session ID (loads points from DB)",
    )
    points: Optional[list[GPSPointInput]] = Field(
        None, description="GPS points (alternative to session_id)",
    )
    max_altitude_m: Optional[float] = None


class TerrainResponse(BaseModel):
    """Terrain difficulty result."""
    overall_score: float
    difficulty_label: str
    gradient_score: float
    elevation_score: float
    variability_score: float
    distance_score: float
    altitude_score: float
    avg_gradient_pct: float
    max_gradient_pct: float
    total_elevation_gain_m: float
    total_elevation_loss_m: float
    total_distance_m: float
    max_altitude_m: float
    gradient_changes_per_km: float


# -- Model Info --

class ModelInfoResponse(BaseModel):
    """Model version and metadata."""
    model_type: str
    model_version: str
    num_features: int
    num_classes: int
    class_labels: list[str]
    accuracy: Optional[float]
    last_updated: str


# ─── Model State (server-side inference) ──────────────────────────────────────

# In production, this would load the actual XGBoost model from disk.
# For now, we use a heuristic classifier matching the on-device fallback.

CURRENT_MODEL_VERSION = "1.0.0-heuristic"
MODEL_LABELS = ["IDLE", "WALKING", "TREKKING", "RUNNING", "CYCLING"]


def _server_predict(points: list[GPSPointInput]) -> tuple[str, float, dict[str, float]]:
    """
    Server-side activity prediction.
    Uses speed-based heuristics as a placeholder until the trained model is deployed.
    """
    speeds = [p.speed or 0.0 for p in points]
    avg_speed = sum(speeds) / len(speeds) if speeds else 0.0

    # Compute altitude gain
    alt_gain = 0.0
    for i in range(1, len(points)):
        a1 = points[i - 1].altitude or 0
        a2 = points[i].altitude or 0
        if a2 > a1:
            alt_gain += (a2 - a1)

    probs = {label: 0.05 for label in MODEL_LABELS}

    if avg_speed < 0.3:
        probs["IDLE"] = 0.80
    elif avg_speed < 1.8:
        if alt_gain > 2.0:
            probs["TREKKING"] = 0.65
            probs["WALKING"] = 0.20
        else:
            probs["WALKING"] = 0.65
            probs["TREKKING"] = 0.20
    elif avg_speed < 4.0:
        probs["RUNNING"] = 0.70
        probs["WALKING"] = 0.10
    else:
        probs["CYCLING"] = 0.75
        probs["RUNNING"] = 0.10

    # Normalize
    total = sum(probs.values())
    probs = {k: round(v / total, 4) for k, v in probs.items()}

    predicted = max(probs, key=probs.get)  # type: ignore
    confidence = probs[predicted]

    return predicted, confidence, probs


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/predict", response_model=PredictResponse)
async def predict_activity(request: PredictRequest):
    """
    Classify the activity type from a window of GPS points.

    This endpoint provides server-side ML inference as a complement to
    on-device TFLite inference. Useful for:
    - Devices that can't run TFLite
    - Batch re-classification of historical data
    - A/B testing between model versions
    """
    import time

    start = time.monotonic()
    
    # Use real ML inference service
    result = await ml_inference_service.extract_and_predict(request.points)
    
    elapsed_ms = (time.monotonic() - start) * 1000

    # MLInferenceResult doesn't output full probabilities array natively yet, 
    # but we can simulate it with a highly-confident one-hot or modify it.
    # For now, put confidence into the selected label and distribute rest.
    probs = {label: 0.0 for label in MODEL_LABELS}
    probs[result.activity.value] = result.confidence

    return PredictResponse(
        predicted_label=result.activity.value,
        confidence=result.confidence,
        probabilities=probs,
        model_version=result.model_version,
        inference_time_ms=round(elapsed_ms, 3),
    )


@router.post("/gap", response_model=GAPResponse)
async def compute_gap(
    request: GAPRequest,
    ts_db: AsyncSession = Depends(get_ts_db),
):
    """
    Compute Grade Adjusted Pace for a trek session or set of GPS points.

    Grade Adjusted Pace normalizes walking/running pace to flat-equivalent
    using the Minetti metabolic cost model, allowing fair comparison of
    performance across different terrain profiles.
    """
    points_data = await _resolve_points(request.session_id, request.points, ts_db)
    segments = gps_points_to_segments(points_data)

    if not segments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Need at least 2 GPS points to compute GAP.",
        )

    summary = compute_session_gap(segments)

    # Optionally include per-segment detail (limit to 500 to avoid huge responses)
    segment_results = None
    if len(segments) <= 500:
        segment_results = [
            GAPSegmentResult(
                actual_pace_min_km=r.actual_pace_min_km,
                gap_pace_min_km=r.gap_pace_min_km,
                adjustment_factor=round(r.adjustment_factor, 4),
                gradient_pct=round(r.gradient_pct, 2),
                distance_m=round(r.distance_m, 2),
                elevation_delta_m=round(r.elevation_delta_m, 2),
            )
            for r in [compute_segment_gap(s) for s in segments]
        ]

    return GAPResponse(
        actual_avg_pace_min_km=(
            round(summary.actual_avg_pace_min_km, 2) if summary.actual_avg_pace_min_km else None
        ),
        gap_avg_pace_min_km=(
            round(summary.gap_avg_pace_min_km, 2) if summary.gap_avg_pace_min_km else None
        ),
        total_distance_m=round(summary.total_distance_m, 2),
        total_elevation_gain_m=round(summary.total_elevation_gain_m, 2),
        total_elevation_loss_m=round(summary.total_elevation_loss_m, 2),
        total_time_s=round(summary.total_time_s, 2),
        num_segments=summary.num_segments,
        avg_gradient_pct=round(summary.avg_gradient_pct, 2),
        segments=segment_results,
    )


@router.post("/terrain", response_model=TerrainResponse)
async def compute_terrain(
    request: TerrainRequest,
    ts_db: AsyncSession = Depends(get_ts_db),
):
    """
    Compute terrain difficulty score for a trek session or set of GPS points.

    Returns a composite 0-10 score based on gradient, elevation, variability,
    distance, and altitude, plus a human-readable difficulty label.
    """
    points_data = await _resolve_points(request.session_id, request.points, ts_db)

    result = compute_terrain_difficulty_from_points(
        points_data,
        max_altitude_m=request.max_altitude_m,
    )

    return TerrainResponse(
        overall_score=result.overall_score,
        difficulty_label=result.difficulty_label,
        gradient_score=result.gradient_score,
        elevation_score=result.elevation_score,
        variability_score=result.variability_score,
        distance_score=result.distance_score,
        altitude_score=result.altitude_score,
        avg_gradient_pct=result.avg_gradient_pct,
        max_gradient_pct=result.max_gradient_pct,
        total_elevation_gain_m=result.total_elevation_gain_m,
        total_elevation_loss_m=result.total_elevation_loss_m,
        total_distance_m=result.total_distance_m,
        max_altitude_m=result.max_altitude_m,
        gradient_changes_per_km=result.gradient_changes_per_km,
    )


@router.get("/model/info", response_model=ModelInfoResponse)
async def get_model_info():
    """
    Get information about the currently deployed ML model.

    Returns version, capabilities, accuracy metrics, and supported classes.
    """
    return ModelInfoResponse(
        model_type="xgboost-distilled",
        model_version=CURRENT_MODEL_VERSION,
        num_features=20,
        num_classes=5,
        class_labels=MODEL_LABELS,
        accuracy=None,  # Will be populated when a trained model is deployed
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _resolve_points(
    session_id: str | None,
    points: list[GPSPointInput] | None,
    ts_db: AsyncSession,
) -> list[dict]:
    """
    Resolve GPS points from either a session_id or inline points array.
    """
    if session_id:
        try:
            sid = UUID(session_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid session_id format.",
            )
        db_points = await get_session_points(ts_db, sid)
        if not db_points:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No GPS points found for session {session_id}.",
            )
        return db_points

    if points:
        return [
            {
                "timestamp": p.timestamp,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "altitude": p.altitude,
                "speed": p.speed,
                "heading": p.heading,
                "accuracy": p.accuracy,
            }
            for p in points
        ]

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide either session_id or points array.",
    )
