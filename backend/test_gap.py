import sys
import os

sys.path.append(os.path.dirname(__file__))

from app.services.gap_service import GPSSegment, compute_segment_gap

scenarios = [
    ("Flat (0% grade)", GPSSegment(distance_m=100.0, elevation_delta_m=0.0, time_s=30.0)),
    ("Gentle Uphill (5% grade)", GPSSegment(distance_m=100.0, elevation_delta_m=5.0, time_s=30.0)),
    ("Steep Uphill (15% grade)", GPSSegment(distance_m=100.0, elevation_delta_m=15.0, time_s=30.0)),
    (
        "Gentle Downhill (-5% grade)",
        GPSSegment(distance_m=100.0, elevation_delta_m=-5.0, time_s=30.0),
    ),
    (
        "Steep Downhill (-15% grade)",
        GPSSegment(distance_m=100.0, elevation_delta_m=-15.0, time_s=30.0),
    ),
]

print(f"\n{chr(61)*50}")
print(f"  TrekTrack AI - Grade Adjusted Pace (GAP) Test")
print(f"{chr(61)*50}")

# Note: 100m in 30s = 3.33 m/s = 5:00 min/km actual pace for all scenarios.
for name, seg in scenarios:
    res = compute_segment_gap(seg)
    print(f"[{name}]")
    print(f"  Actual Pace : {res.actual_pace_min_km:5.2f} min/km")
    print(f"  GAP Factor  : x{res.adjustment_factor:.2f}")
    print(f"  GAP         : {res.gap_pace_min_km:5.2f} min/km")
    print("-" * 50)
