"""
terrain_service.py — Terrain Difficulty Scoring

Computes a composite terrain difficulty score (0–10) for a trek session
based on multiple factors:

1. **Gradient Score** — Steepness of the terrain (avg and max gradient)
2. **Elevation Score** — Total elevation gain and loss
3. **Variability Score** — How much the gradient changes (roughness)
4. **Distance Score** — Longer treks are harder
5. **Altitude Score** — Higher altitude increases difficulty (thin air)

The final score is a weighted combination of these sub-scores.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.services.gap_service import GPSSegment, gps_points_to_segments


# ─── Scoring Configuration ───────────────────────────────────────────────────

@dataclass
class TerrainScoringWeights:
    """Weights for each difficulty component (must sum to 1.0)."""
    gradient: float = 0.30
    elevation: float = 0.25
    variability: float = 0.15
    distance: float = 0.15
    altitude: float = 0.15


DEFAULT_WEIGHTS = TerrainScoringWeights()


# ─── Result Types ─────────────────────────────────────────────────────────────

@dataclass
class TerrainDifficultyResult:
    """Complete terrain difficulty analysis."""
    overall_score: float        # 0-10 composite score
    difficulty_label: str       # "Easy", "Moderate", "Hard", "Expert", "Extreme"

    # Sub-scores (each 0-10)
    gradient_score: float
    elevation_score: float
    variability_score: float
    distance_score: float
    altitude_score: float

    # Raw statistics
    avg_gradient_pct: float
    max_gradient_pct: float
    total_elevation_gain_m: float
    total_elevation_loss_m: float
    total_distance_m: float
    max_altitude_m: float
    gradient_changes_per_km: float  # terrain roughness metric


# ─── Sub-Score Functions ──────────────────────────────────────────────────────

def _sigmoid_score(value: float, midpoint: float, steepness: float = 1.0) -> float:
    """
    Map a value to 0-10 using a sigmoid curve.
    - midpoint: the value that maps to 5.0
    - steepness: how quickly the curve transitions
    """
    x = steepness * (value - midpoint) / midpoint if midpoint != 0 else 0
    return 10.0 / (1.0 + math.exp(-x))


def _linear_score(value: float, min_val: float, max_val: float) -> float:
    """Linear mapping from [min_val, max_val] → [0, 10], clamped."""
    if max_val <= min_val:
        return 0.0
    score = 10.0 * (value - min_val) / (max_val - min_val)
    return max(0.0, min(10.0, score))


def compute_gradient_score(
    avg_abs_gradient_pct: float,
    max_abs_gradient_pct: float,
) -> float:
    """
    Score based on average and maximum gradient.
    - 0-3% average: Easy (0-3)
    - 3-8% average: Moderate (3-5)
    - 8-15% average: Hard (5-7)
    - 15-25%: Expert (7-9)
    - 25%+: Extreme (9-10)
    """
    avg_score = _sigmoid_score(avg_abs_gradient_pct, midpoint=12, steepness=1.5)
    max_score = _sigmoid_score(max_abs_gradient_pct, midpoint=30, steepness=1.0)
    return 0.7 * avg_score + 0.3 * max_score


def compute_elevation_score(
    total_gain_m: float,
    total_loss_m: float,
    distance_m: float,
) -> float:
    """
    Score based on total elevation change relative to distance.
    Uses gain/km as the primary metric.
    """
    if distance_m < 100:
        return 0.0
    gain_per_km = (total_gain_m / distance_m) * 1000
    loss_per_km = (total_loss_m / distance_m) * 1000
    # Gain is weighted more (uphill is harder than downhill)
    combined = gain_per_km * 0.7 + loss_per_km * 0.3
    # 50m/km gain = easy, 150m/km = hard, 300m/km = extreme
    return _sigmoid_score(combined, midpoint=150, steepness=1.2)


def compute_variability_score(gradients: list[float]) -> float:
    """
    Score based on how much the gradient changes between segments.
    More gradient changes = rougher terrain = higher difficulty.
    """
    if len(gradients) < 2:
        return 0.0

    changes = []
    for i in range(1, len(gradients)):
        changes.append(abs(gradients[i] - gradients[i - 1]))

    avg_change = sum(changes) / len(changes)
    max_change = max(changes) if changes else 0

    # avg_change in % gradient: 2% = smooth, 10% = rough, 20% = very rough
    return _sigmoid_score(avg_change * 100, midpoint=8, steepness=1.3)


def compute_distance_score(total_distance_m: float) -> float:
    """
    Score based on total trek distance.
    5 km = easy, 15 km = moderate, 30 km = hard, 50 km+ = extreme
    """
    distance_km = total_distance_m / 1000
    return _sigmoid_score(distance_km, midpoint=20, steepness=1.0)


def compute_altitude_score(max_altitude_m: float) -> float:
    """
    Score based on maximum altitude reached.
    Altitude effects kick in above ~2000m, severe above 4000m.
    """
    if max_altitude_m < 1000:
        return 0.0
    return _sigmoid_score(max_altitude_m, midpoint=3500, steepness=0.8)


# ─── Difficulty Label ─────────────────────────────────────────────────────────

def difficulty_label(score: float) -> str:
    """Map a 0-10 score to a human-readable difficulty label."""
    if score < 2.0:
        return "Easy"
    elif score < 4.0:
        return "Moderate"
    elif score < 6.0:
        return "Hard"
    elif score < 8.0:
        return "Expert"
    else:
        return "Extreme"


# ─── Main Scoring Function ───────────────────────────────────────────────────

def compute_terrain_difficulty(
    segments: list[GPSSegment],
    max_altitude_m: float = 0.0,
    weights: TerrainScoringWeights | None = None,
) -> TerrainDifficultyResult:
    """
    Compute the terrain difficulty score from GPS segments.

    Args:
        segments: List of GPSSegment from the trek.
        max_altitude_m: Maximum altitude reached during the trek.
        weights: Optional custom scoring weights.

    Returns:
        TerrainDifficultyResult with overall and sub-scores.
    """
    w = weights or DEFAULT_WEIGHTS

    if not segments:
        return TerrainDifficultyResult(
            overall_score=0.0,
            difficulty_label="Easy",
            gradient_score=0.0,
            elevation_score=0.0,
            variability_score=0.0,
            distance_score=0.0,
            altitude_score=0.0,
            avg_gradient_pct=0.0,
            max_gradient_pct=0.0,
            total_elevation_gain_m=0.0,
            total_elevation_loss_m=0.0,
            total_distance_m=0.0,
            max_altitude_m=max_altitude_m,
            gradient_changes_per_km=0.0,
        )

    # ── Compute raw statistics ──
    gradients: list[float] = []
    total_distance = 0.0
    total_gain = 0.0
    total_loss = 0.0

    for seg in segments:
        if seg.distance_m > 0.1:
            gradient = seg.elevation_delta_m / seg.distance_m
        else:
            gradient = 0.0
        gradients.append(gradient)
        total_distance += seg.distance_m
        if seg.elevation_delta_m > 0:
            total_gain += seg.elevation_delta_m
        else:
            total_loss += abs(seg.elevation_delta_m)

    abs_gradients = [abs(g) for g in gradients]
    avg_gradient_pct = (sum(abs_gradients) / len(abs_gradients)) * 100
    max_gradient_pct = max(abs_gradients) * 100

    # Gradient changes per km (roughness metric)
    gradient_changes = sum(
        1 for i in range(1, len(gradients))
        if abs(gradients[i] - gradients[i - 1]) > 0.02  # >2% change
    )
    gradient_changes_per_km = (
        (gradient_changes / total_distance) * 1000
        if total_distance > 0
        else 0.0
    )

    # ── Compute sub-scores ──
    grad_score = compute_gradient_score(avg_gradient_pct, max_gradient_pct)
    elev_score = compute_elevation_score(total_gain, total_loss, total_distance)
    var_score = compute_variability_score(gradients)
    dist_score = compute_distance_score(total_distance)
    alt_score = compute_altitude_score(max_altitude_m)

    # ── Weighted composite ──
    overall = (
        w.gradient * grad_score
        + w.elevation * elev_score
        + w.variability * var_score
        + w.distance * dist_score
        + w.altitude * alt_score
    )
    overall = max(0.0, min(10.0, overall))

    return TerrainDifficultyResult(
        overall_score=round(overall, 2),
        difficulty_label=difficulty_label(overall),
        gradient_score=round(grad_score, 2),
        elevation_score=round(elev_score, 2),
        variability_score=round(var_score, 2),
        distance_score=round(dist_score, 2),
        altitude_score=round(alt_score, 2),
        avg_gradient_pct=round(avg_gradient_pct, 2),
        max_gradient_pct=round(max_gradient_pct, 2),
        total_elevation_gain_m=round(total_gain, 2),
        total_elevation_loss_m=round(total_loss, 2),
        total_distance_m=round(total_distance, 2),
        max_altitude_m=round(max_altitude_m, 2),
        gradient_changes_per_km=round(gradient_changes_per_km, 2),
    )


def compute_terrain_difficulty_from_points(
    points: list[dict],
    max_altitude_m: float | None = None,
    weights: TerrainScoringWeights | None = None,
) -> TerrainDifficultyResult:
    """
    Convenience function: compute terrain difficulty directly from GPS point dicts.

    Args:
        points: List of GPS point dicts with latitude, longitude, altitude, time.
        max_altitude_m: Optional override for max altitude. If None, computed from data.
        weights: Optional custom scoring weights.
    """
    segments = gps_points_to_segments(points)

    if max_altitude_m is None:
        altitudes = [p.get("altitude", 0) or 0 for p in points]
        max_altitude_m = max(altitudes) if altitudes else 0.0

    return compute_terrain_difficulty(segments, max_altitude_m, weights)
