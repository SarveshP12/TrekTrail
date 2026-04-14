"""
gap_service.py — Grade Adjusted Pace (GAP) Calculation

Adjusts a trekker's pace based on terrain gradient (slope), normalizing
uphill/downhill effort to flat-equivalent pace for fair comparisons.

Uses the Minetti et al. (2002) cost-of-transport model, which provides
metabolic cost as a function of gradient, to derive equivalent flat pace.

Reference:
  Minetti, A.E. et al. (2002). "Energy cost of walking and running at extreme
  uphill and downhill slopes." J. Applied Physiology, 93(3), 1039-1046.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ─── Minetti Cost-of-Transport Model ──────────────────────────────────────────

# Polynomial coefficients for metabolic cost (J/kg/m) as a function of gradient.
# C(g) = 280.5·g⁵ − 58.7·g⁴ − 76.8·g³ + 51.9·g² + 19.6·g + 2.5
# where g is the gradient (rise/run), e.g. 0.10 = 10% slope.
MINETTI_COEFFS = [280.5, -58.7, -76.8, 51.9, 19.6, 2.5]

# Cost on flat ground (g=0): C(0) = 2.5 J/kg/m
FLAT_COST = MINETTI_COEFFS[-1]


def _minetti_cost(gradient: float) -> float:
    """
    Metabolic cost of locomotion at a given gradient (J/kg/m).
    Gradient is expressed as a fraction (e.g. 0.10 for 10% grade).
    """
    g = max(-0.50, min(0.50, gradient))  # clamp to ±50%
    g2 = g * g
    g3 = g2 * g
    g4 = g3 * g
    g5 = g4 * g
    cost = (
        MINETTI_COEFFS[0] * g5
        + MINETTI_COEFFS[1] * g4
        + MINETTI_COEFFS[2] * g3
        + MINETTI_COEFFS[3] * g2
        + MINETTI_COEFFS[4] * g
        + MINETTI_COEFFS[5]
    )
    return max(cost, 0.1)  # prevent division by zero or negative cost


def grade_adjustment_factor(gradient: float) -> float:
    """
    Compute the GAP adjustment factor for a given gradient.

    Returns a multiplier where:
      - 1.0 = flat terrain (no adjustment)
      - > 1.0 = uphill (actual pace is slower → flat-equivalent is faster)
      - < 1.0 = downhill (actual pace is faster → flat-equivalent is slower)

    Args:
        gradient: Rise over run (e.g. 0.10 = 10% uphill, -0.05 = 5% downhill)
    """
    actual_cost = _minetti_cost(gradient)
    return actual_cost / FLAT_COST


# ─── Data Types ───────────────────────────────────────────────────────────────


@dataclass
class GPSSegment:
    """A segment between two GPS points."""

    distance_m: float  # horizontal distance in meters
    elevation_delta_m: float  # altitude change (positive = uphill)
    time_s: float  # time elapsed in seconds


@dataclass
class GAPResult:
    """Result of Grade Adjusted Pace calculation."""

    actual_pace_min_km: float | None  # raw pace (min/km)
    gap_pace_min_km: float | None  # grade-adjusted pace (min/km)
    adjustment_factor: float  # multiplier applied
    gradient_pct: float  # gradient in percent
    distance_m: float  # horizontal distance
    elevation_delta_m: float  # elevation change


@dataclass
class SessionGAPSummary:
    """Aggregate GAP statistics for an entire trek session."""

    actual_avg_pace_min_km: float | None
    gap_avg_pace_min_km: float | None
    total_distance_m: float
    total_elevation_gain_m: float
    total_elevation_loss_m: float
    total_time_s: float
    num_segments: int
    avg_gradient_pct: float


# ─── Core GAP Functions ──────────────────────────────────────────────────────


def compute_segment_gap(segment: GPSSegment) -> GAPResult:
    """
    Compute Grade Adjusted Pace for a single GPS segment.

    Args:
        segment: A GPSSegment with distance, elevation delta, and time.

    Returns:
        GAPResult with actual and adjusted pace.
    """
    # Compute gradient
    if segment.distance_m > 0.1:
        gradient = segment.elevation_delta_m / segment.distance_m
    else:
        gradient = 0.0

    gradient_pct = gradient * 100

    # Compute actual pace
    if segment.distance_m > 0.1 and segment.time_s > 0:
        speed_ms = segment.distance_m / segment.time_s
        actual_pace = (1000 / speed_ms) / 60  # min/km
    else:
        actual_pace = None

    # Compute GAP
    factor = grade_adjustment_factor(gradient)
    if actual_pace is not None:
        gap_pace = actual_pace / factor
    else:
        gap_pace = None

    return GAPResult(
        actual_pace_min_km=actual_pace,
        gap_pace_min_km=gap_pace,
        adjustment_factor=factor,
        gradient_pct=gradient_pct,
        distance_m=segment.distance_m,
        elevation_delta_m=segment.elevation_delta_m,
    )


def compute_session_gap(segments: list[GPSSegment]) -> SessionGAPSummary:
    """
    Compute aggregate GAP statistics for a full trek session.

    Args:
        segments: List of GPS segments for the entire session.

    Returns:
        SessionGAPSummary with aggregate metrics.
    """
    if not segments:
        return SessionGAPSummary(
            actual_avg_pace_min_km=None,
            gap_avg_pace_min_km=None,
            total_distance_m=0,
            total_elevation_gain_m=0,
            total_elevation_loss_m=0,
            total_time_s=0,
            num_segments=0,
            avg_gradient_pct=0,
        )

    total_distance = 0.0
    total_time = 0.0
    total_gain = 0.0
    total_loss = 0.0
    weighted_factor_sum = 0.0
    gradient_sum = 0.0

    for seg in segments:
        total_distance += seg.distance_m
        total_time += seg.time_s

        if seg.elevation_delta_m > 0:
            total_gain += seg.elevation_delta_m
        else:
            total_loss += abs(seg.elevation_delta_m)

        gradient = (
            seg.elevation_delta_m / seg.distance_m if seg.distance_m > 0.1 else 0.0
        )
        gradient_sum += gradient

        factor = grade_adjustment_factor(gradient)
        weighted_factor_sum += factor * seg.distance_m

    # Actual average pace
    if total_distance > 0.1 and total_time > 0:
        avg_speed = total_distance / total_time
        actual_avg_pace = (1000 / avg_speed) / 60
    else:
        actual_avg_pace = None

    # GAP average pace (distance-weighted adjustment)
    avg_factor = weighted_factor_sum / total_distance if total_distance > 0.1 else 1.0
    gap_avg_pace = actual_avg_pace / avg_factor if actual_avg_pace else None

    avg_gradient_pct = (gradient_sum / len(segments)) * 100

    return SessionGAPSummary(
        actual_avg_pace_min_km=actual_avg_pace,
        gap_avg_pace_min_km=gap_avg_pace,
        total_distance_m=total_distance,
        total_elevation_gain_m=total_gain,
        total_elevation_loss_m=total_loss,
        total_time_s=total_time,
        num_segments=len(segments),
        avg_gradient_pct=avg_gradient_pct,
    )


def gps_points_to_segments(points: list[dict]) -> list[GPSSegment]:
    """
    Convert a list of GPS point dicts (from the database) into GPS segments.

    Expected dict keys: latitude, longitude, altitude, time (or timestamp).
    """
    segments: list[GPSSegment] = []
    earth_r = 6_371_000

    for i in range(1, len(points)):
        prev = points[i - 1]
        curr = points[i]

        lat1, lon1 = math.radians(prev["latitude"]), math.radians(prev["longitude"])
        lat2, lon2 = math.radians(curr["latitude"]), math.radians(curr["longitude"])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        distance_m = earth_r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        alt1 = prev.get("altitude") or 0.0
        alt2 = curr.get("altitude") or 0.0
        elevation_delta = alt2 - alt1

        # Time difference
        t1 = prev.get("time") or prev.get("timestamp", 0)
        t2 = curr.get("time") or curr.get("timestamp", 0)
        if isinstance(t1, (int, float)) and isinstance(t2, (int, float)):
            time_s = abs(t2 - t1)
            if time_s > 1000:  # likely milliseconds
                time_s /= 1000
        else:
            time_s = (t2 - t1).total_seconds() if hasattr(t2, "total_seconds") else 1.0

        segments.append(
            GPSSegment(
                distance_m=distance_m,
                elevation_delta_m=elevation_delta,
                time_s=max(time_s, 0.001),
            )
        )

    return segments
