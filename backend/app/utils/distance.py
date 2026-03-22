import math
from typing import Any


def haversine_2d(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate 2D distance in meters between two GPS points using Haversine formula."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_3d(
    lat1: float, lon1: float, alt1: float, lat2: float, lon2: float, alt2: float
) -> float:
    """Calculate 3D distance incorporating elevation change."""
    horizontal = haversine_2d(lat1, lon1, lat2, lon2)
    vertical = alt2 - alt1
    return math.sqrt(horizontal**2 + vertical**2)


def compute_trek_stats(points: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute all trek statistics from a list of GPS points.

    Each point dict has: latitude, longitude, altitude (nullable), time.
    """
    if len(points) < 2:
        return _empty_stats()

    total_2d = 0.0
    total_3d = 0.0
    elevation_gain = 0.0
    elevation_loss = 0.0
    altitudes = []

    for i in range(1, len(points)):
        p1, p2 = points[i - 1], points[i]

        d2d = haversine_2d(p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"])
        total_2d += d2d

        alt1 = p1.get("altitude") or 0.0
        alt2 = p2.get("altitude") or 0.0

        d3d = distance_3d(
            p1["latitude"], p1["longitude"], alt1, p2["latitude"], p2["longitude"], alt2
        )
        total_3d += d3d

        delta_alt = alt2 - alt1
        if delta_alt > 0:
            elevation_gain += delta_alt
        else:
            elevation_loss += abs(delta_alt)

        if p2.get("altitude") is not None:
            altitudes.append(p2["altitude"])
    if points[0].get("altitude") is not None:
        altitudes.insert(0, points[0]["altitude"])

    # Duration in seconds
    duration = (points[-1]["time"] - points[0]["time"]).total_seconds()
    avg_speed = (total_3d / duration * 3.6) if duration > 0 else 0  # km/h

    # Calorie estimation: ~50 cal per km for trekking, +0.5 cal per meter of gain
    calories = int(total_3d / 1000 * 50 + elevation_gain * 0.5)

    # Difficulty rating
    difficulty = _compute_difficulty(total_3d, elevation_gain, altitudes)

    return {
        "distance_2d": round(total_2d, 2),
        "distance_3d": round(total_3d, 2),
        "elevation_gain": round(elevation_gain, 2),
        "elevation_loss": round(elevation_loss, 2),
        "max_altitude": round(max(altitudes), 2) if altitudes else None,
        "min_altitude": round(min(altitudes), 2) if altitudes else None,
        "calories_burned": calories,
        "difficulty_rating": difficulty,
        "avg_speed": round(avg_speed, 2),
    }


def _compute_difficulty(
    distance_3d: float, elevation_gain: float, altitudes: list[float]
) -> str:
    score = 0
    # Distance factor
    if distance_3d > 20000:
        score += 3
    elif distance_3d > 10000:
        score += 2
    elif distance_3d > 5000:
        score += 1

    # Elevation gain factor
    if elevation_gain > 1500:
        score += 3
    elif elevation_gain > 800:
        score += 2
    elif elevation_gain > 300:
        score += 1

    # Max altitude factor
    if altitudes:
        max_alt = max(altitudes)
        if max_alt > 4000:
            score += 2
        elif max_alt > 2500:
            score += 1

    if score >= 6:
        return "Expert"
    elif score >= 4:
        return "Hard"
    elif score >= 2:
        return "Moderate"
    return "Easy"


def _empty_stats() -> dict[str, Any]:
    return {
        "distance_2d": 0,
        "distance_3d": 0,
        "elevation_gain": 0,
        "elevation_loss": 0,
        "max_altitude": None,
        "min_altitude": None,
        "calories_burned": 0,
        "difficulty_rating": "Easy",
        "avg_speed": 0,
    }
