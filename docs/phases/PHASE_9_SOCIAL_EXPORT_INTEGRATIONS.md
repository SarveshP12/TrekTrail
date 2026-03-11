# Phase 9: Social Features, Export & Third-Party Integrations

## Phase Title

**Social Features, Export & Third-Party Integrations — Sharing, Leaderboards, GPX/KML Export, Health App Sync, and Strava**

---

## Objective

Add all social and sharing features: trek infographic generation, social sharing, global/friend leaderboards, GPX/KML file export from mobile, Apple Health and Google Fit sync, Strava activity upload, and push notifications for achievements and group invites. After this phase, the app is socially engaging with sharing, competition, and seamless integration into the broader fitness ecosystem.

---

## Features Implemented in This Phase

- Trek infographic image generation (summary card with map thumbnail, stats, branding)
- Social sharing (share infographic to Instagram, WhatsApp, Twitter, etc.)
- Global and friend leaderboards (weekly/monthly/all-time)
- Achievement / badge system (first trek, 100 km milestone, elevation records)
- GPX and KML file export from mobile (download or share)
- Apple HealthKit integration (write workouts, read resting heart rate)
- Google Fit integration (write sessions, read step count)
- Strava API integration (auto-upload completed treks as activities)
- Push notifications (Firebase Cloud Messaging) for achievements, group invites, weekly summaries

---

## Tasks Breakdown

* Task 1: Build backend leaderboard service and endpoints
* Task 2: Build backend achievement / badge engine
* Task 3: Build backend infographic generation service (Pillow-based image)
* Task 4: Build `GET /sessions/{id}/infographic` endpoint
* Task 5: Build mobile leaderboard screen
* Task 6: Build mobile achievements screen
* Task 7: Build mobile share flow (share infographic + GPX file)
* Task 8: Implement Apple HealthKit integration (React Native bridge)
* Task 9: Implement Google Fit integration (React Native bridge)
* Task 10: Build Strava OAuth flow and activity upload
* Task 11: Configure Firebase Cloud Messaging and push notification service
* Task 12: Build notification handling and in-app notification center
* Task 13: Write integration tests

---

## File Structure for This Phase

```
backend/app/
├── api/
│   ├── leaderboard.py                    # GET /leaderboard (global, friends, weekly/monthly)
│   ├── achievements.py                   # GET /users/{id}/achievements
│   ├── infographic.py                    # GET /sessions/{id}/infographic → PNG
│   └── integrations.py                   # POST /integrations/strava/connect, /strava/sync
├── services/
│   ├── leaderboard_service.py            # Query + rank users
│   ├── achievement_service.py            # Check milestones, award badges
│   ├── infographic_service.py            # Generate trek summary image
│   ├── strava_service.py                 # Strava OAuth + activity upload
│   └── notification_service.py           # FCM push notification sender
├── models/
│   ├── achievement.py                    # Achievement, UserAchievement models
│   └── integration.py                    # UserIntegration model (Strava tokens)

mobile/src/
├── screens/
│   ├── LeaderboardScreen.tsx
│   ├── AchievementsScreen.tsx
│   └── IntegrationsScreen.tsx            # Connect Strava, Health, Google Fit
├── services/
│   ├── health/
│   │   ├── HealthKitService.ts           # Apple HealthKit bridge
│   │   └── GoogleFitService.ts           # Google Fit bridge
│   ├── integrations/
│   │   ├── StravaService.ts              # Strava OAuth + sync
│   │   └── ShareService.ts              # Share infographic + files
│   └── notifications/
│       ├── PushNotificationService.ts    # FCM registration + handling
│       └── NotificationStore.ts          # In-app notification state
├── components/
│   ├── LeaderboardRow.tsx
│   ├── AchievementBadge.tsx
│   ├── NotificationBell.tsx
│   └── ShareButton.tsx
```

---

## Implementation Guide

### Task 1 — Leaderboard Service

`backend/app/services/leaderboard_service.py`:

```python
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trek_session import TrekSession
from app.models.user import User


async def get_leaderboard(
    db: AsyncSession,
    period: str = "all_time",  # weekly | monthly | all_time
    metric: str = "distance",  # distance | elevation | treks
    limit: int = 50,
) -> list[dict]:
    """Return ranked list of users by the chosen metric."""
    filters = [TrekSession.status == "completed"]

    if period == "weekly":
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        filters.append(TrekSession.start_time >= cutoff)
    elif period == "monthly":
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        filters.append(TrekSession.start_time >= cutoff)

    if metric == "distance":
        agg_col = func.sum(TrekSession.distance_3d)
    elif metric == "elevation":
        agg_col = func.sum(TrekSession.elevation_gain)
    else:
        agg_col = func.count(TrekSession.id)

    query = (
        select(User.id, User.display_name, agg_col.label("value"))
        .join(TrekSession, TrekSession.user_id == User.id)
        .where(*filters)
        .group_by(User.id, User.display_name)
        .order_by(agg_col.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {"rank": i + 1, "user_id": str(row.id), "display_name": row.display_name, "value": float(row.value or 0)}
        for i, row in enumerate(rows)
    ]
```

`backend/app/api/leaderboard.py`:

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.services.leaderboard_service import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/")
async def leaderboard(
    period: str = Query("all_time", regex="^(weekly|monthly|all_time)$"),
    metric: str = Query("distance", regex="^(distance|elevation|treks)$"),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_leaderboard(db, period, metric, limit)
```

### Task 2 — Achievement Engine

`backend/app/models/achievement.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(50), unique=True, nullable=False)  # e.g. "first_trek"
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))  # emoji or icon name
    criteria_type = Column(String(30))  # distance, elevation, count, streak
    criteria_value = Column(String(50))  # "100000" (meters), "10" (count), etc.


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    achievement_id = Column(UUID(as_uuid=True), ForeignKey("achievements.id"), nullable=False)
    earned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

`backend/app/services/achievement_service.py`:

```python
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import Achievement, UserAchievement
from app.models.trek_session import TrekSession


MILESTONE_DEFINITIONS = [
    {"key": "first_trek", "name": "First Steps", "icon": "🥾", "criteria_type": "count", "criteria_value": "1", "description": "Complete your first trek"},
    {"key": "distance_10k", "name": "10K Trekker", "icon": "🏃", "criteria_type": "distance", "criteria_value": "10000", "description": "Trek a total of 10 km"},
    {"key": "distance_100k", "name": "Century Club", "icon": "💯", "criteria_type": "distance", "criteria_value": "100000", "description": "Trek a total of 100 km"},
    {"key": "distance_1000k", "name": "Iron Legs", "icon": "🦿", "criteria_type": "distance", "criteria_value": "1000000", "description": "Trek a total of 1,000 km"},
    {"key": "elevation_5k", "name": "Mountain Goat", "icon": "🐐", "criteria_type": "elevation", "criteria_value": "5000", "description": "Gain 5,000 m of elevation"},
    {"key": "elevation_20k", "name": "Everest Equivalent", "icon": "🏔️", "criteria_type": "elevation", "criteria_value": "20000", "description": "Gain 20,000 m of elevation"},
    {"key": "treks_10", "name": "Regular Trekker", "icon": "📅", "criteria_type": "count", "criteria_value": "10", "description": "Complete 10 treks"},
    {"key": "treks_50", "name": "Trail Veteran", "icon": "⭐", "criteria_type": "count", "criteria_value": "50", "description": "Complete 50 treks"},
]


async def check_and_award(db: AsyncSession, user_id: UUID) -> list[dict]:
    """Check all milestones and award any newly earned achievements. Returns newly awarded list."""
    # Get user totals
    stats_q = select(
        func.count(TrekSession.id).label("trek_count"),
        func.coalesce(func.sum(TrekSession.distance_3d), 0).label("total_distance"),
        func.coalesce(func.sum(TrekSession.elevation_gain), 0).label("total_elevation"),
    ).where(TrekSession.user_id == user_id, TrekSession.status == "completed")

    result = await db.execute(stats_q)
    row = result.one()
    trek_count, total_distance, total_elevation = row.trek_count, float(row.total_distance), float(row.total_elevation)

    # Get already earned
    earned_q = select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id)
    earned_result = await db.execute(earned_q)
    earned_ids = {r[0] for r in earned_result.all()}

    # Get all achievements
    all_q = select(Achievement)
    all_result = await db.execute(all_q)
    all_achievements = {a.key: a for a in all_result.scalars().all()}

    newly_awarded = []
    for defn in MILESTONE_DEFINITIONS:
        achievement = all_achievements.get(defn["key"])
        if not achievement or achievement.id in earned_ids:
            continue

        threshold = float(defn["criteria_value"])
        met = False
        if defn["criteria_type"] == "distance":
            met = total_distance >= threshold
        elif defn["criteria_type"] == "elevation":
            met = total_elevation >= threshold
        elif defn["criteria_type"] == "count":
            met = trek_count >= threshold

        if met:
            ua = UserAchievement(user_id=user_id, achievement_id=achievement.id)
            db.add(ua)
            newly_awarded.append({"key": defn["key"], "name": defn["name"], "icon": defn["icon"]})

    if newly_awarded:
        await db.flush()

    return newly_awarded
```

### Task 3 — Infographic Generation

`backend/app/services/infographic_service.py`:

```python
"""Generate a trek summary infographic as a PNG image."""
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

# Use a built-in font; for production, bundle a custom .ttf
FONT_SIZE_TITLE = 36
FONT_SIZE_STAT = 28
FONT_SIZE_LABEL = 16
WIDTH, HEIGHT = 1080, 1350  # Instagram story-ish


def generate_infographic(session: dict, route_points: list[dict]) -> bytes:
    img = Image.new("RGB", (WIDTH, HEIGHT), color="#1B5E20")
    draw = ImageDraw.Draw(img)

    # Title
    y = 60
    draw.text((WIDTH // 2, y), "TrekTrack AI", fill="#FFFFFF", anchor="mt")
    y += 60
    draw.text((WIDTH // 2, y), session.get("activity_type", "Trek"), fill="#A5D6A7", anchor="mt")

    # Stats grid
    y += 100
    stats = [
        ("Distance", f"{(session.get('distance_3d', 0) / 1000):.2f} km"),
        ("Duration", _fmt_duration(session.get("duration_seconds", 0))),
        ("Elevation ↑", f"{session.get('elevation_gain', 0):.0f} m"),
        ("Elevation ↓", f"{session.get('elevation_loss', 0):.0f} m"),
        ("Avg Speed", f"{session.get('avg_speed', 0):.1f} km/h"),
        ("Calories", f"{session.get('calories_burned', 0)} kcal"),
        ("Difficulty", session.get("difficulty_rating", "Easy")),
    ]

    for i, (label, value) in enumerate(stats):
        col = i % 2
        row = i // 2
        x = 100 + col * 480
        cy = y + row * 120
        draw.text((x, cy), label, fill="#A5D6A7")
        draw.text((x, cy + 30), value, fill="#FFFFFF")

    # Mini route map
    if route_points and len(route_points) >= 2:
        map_y = y + 500
        _draw_route(draw, route_points, 100, map_y, WIDTH - 200, 300)

    # Footer
    draw.text((WIDTH // 2, HEIGHT - 40), "Recorded with TrekTrack AI", fill="#66BB6A", anchor="mb")

    buf = BytesIO()
    img.save(buf, format="PNG", quality=95)
    return buf.getvalue()


def _draw_route(draw: ImageDraw.Draw, points: list[dict], x: int, y: int, w: int, h: int):
    lats = [p["latitude"] for p in points]
    lons = [p["longitude"] for p in points]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    lat_range = max_lat - min_lat or 0.001
    lon_range = max_lon - min_lon or 0.001

    scaled = []
    for p in points:
        px = x + int((p["longitude"] - min_lon) / lon_range * w)
        py = y + h - int((p["latitude"] - min_lat) / lat_range * h)
        scaled.append((px, py))

    if len(scaled) >= 2:
        draw.line(scaled, fill="#66BB6A", width=3)


def _fmt_duration(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{h}h {m}m" if h > 0 else f"{m}m"
```

### Task 10 — Strava Integration

`backend/app/services/strava_service.py`:

```python
"""Strava OAuth and activity upload."""
import httpx

from app.config import settings

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_UPLOAD_URL = "https://www.strava.com/api/v3/uploads"


def get_auth_url(redirect_uri: str) -> str:
    return (
        f"{STRAVA_AUTH_URL}?"
        f"client_id={settings.strava_client_id}&"
        f"response_type=code&"
        f"redirect_uri={redirect_uri}&"
        f"scope=activity:write&"
        f"approval_prompt=auto"
    )


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(STRAVA_TOKEN_URL, data={
            "client_id": settings.strava_client_id,
            "client_secret": settings.strava_client_secret,
            "code": code,
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        return resp.json()


async def upload_activity(access_token: str, gpx_bytes: bytes, name: str, activity_type: str = "Hike") -> dict:
    """Upload a GPX file to Strava as a new activity."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            STRAVA_UPLOAD_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            data={"data_type": "gpx", "name": name, "activity_type": activity_type},
            files={"file": (f"{name}.gpx", gpx_bytes, "application/gpx+xml")},
        )
        resp.raise_for_status()
        return resp.json()
```

### Task 8 — Apple HealthKit Service (Mobile)

`mobile/src/services/health/HealthKitService.ts`:

```typescript
import { Platform } from 'react-native';

// Uses react-native-health (iOS only)
let AppleHealthKit: any;
if (Platform.OS === 'ios') {
  AppleHealthKit = require('react-native-health').default;
}

export class HealthKitService {
  private isAvailable = false;

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !AppleHealthKit) return false;

    return new Promise((resolve) => {
      const permissions = {
        permissions: {
          read: ['HeartRate'],
          write: ['Workout', 'DistanceWalkingRunning', 'ActiveEnergyBurned', 'FlightsClimbed'],
        },
      };
      AppleHealthKit.initHealthKit(permissions, (err: any) => {
        this.isAvailable = !err;
        resolve(this.isAvailable);
      });
    });
  }

  async writeWorkout(data: {
    startDate: string;
    endDate: string;
    energyBurned: number;
    distance: number;  // meters
    type: string;      // 'Hiking'
  }): Promise<void> {
    if (!this.isAvailable) return;

    return new Promise((resolve, reject) => {
      AppleHealthKit.saveWorkout(
        {
          type: data.type,
          startDate: data.startDate,
          endDate: data.endDate,
          energyBurned: data.energyBurned,
          energyBurnedUnit: 'kilocalorie',
          distance: data.distance,
          distanceUnit: 'meter',
        },
        (err: any) => (err ? reject(err) : resolve()),
      );
    });
  }
}

export const healthKitService = new HealthKitService();
```

### Task 11 — Push Notifications

`backend/app/services/notification_service.py`:

```python
"""Firebase Cloud Messaging push notification sender."""
import httpx

from app.config import settings


async def send_push(device_token: str, title: str, body: str, data: dict | None = None) -> bool:
    """Send a push notification via FCM HTTP v1 API."""
    message = {
        "message": {
            "token": device_token,
            "notification": {"title": title, "body": body},
            "data": data or {},
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://fcm.googleapis.com/v1/projects/{settings.firebase_project_id}/messages:send",
                headers={
                    "Authorization": f"Bearer {settings.firebase_access_token}",
                    "Content-Type": "application/json",
                },
                json=message,
            )
            return resp.status_code == 200
    except Exception:
        return False


async def send_achievement_notification(device_token: str, achievement_name: str, icon: str):
    await send_push(
        device_token,
        title=f"🏆 Achievement Unlocked!",
        body=f"{icon} {achievement_name}",
        data={"type": "achievement", "name": achievement_name},
    )


async def send_group_invite_notification(device_token: str, inviter_name: str, invite_code: str):
    await send_push(
        device_token,
        title=f"Group Trek Invite",
        body=f"{inviter_name} invited you to a group trek!",
        data={"type": "group_invite", "invite_code": invite_code},
    )
```

---

## Dependencies

### Backend additions

```
Pillow==10.2.0
```

### Mobile additions

```json
{
  "react-native-health": "^1.15.0",
  "react-native-google-fit": "^0.20.0",
  "react-native-share": "^10.0.0",
  "@react-native-firebase/app": "^19.0.0",
  "@react-native-firebase/messaging": "^19.0.0"
}
```

---

## Expected Output

After completing this phase:

1. Leaderboard screen shows global/friend rankings by distance, elevation, or trek count.
2. Achievement badges are automatically awarded when milestones are reached.
3. Users can generate and share a visually appealing infographic for any completed trek.
4. GPX/KML files can be exported and shared directly from the mobile app.
5. Treks automatically sync to Apple Health (iOS) and Google Fit (Android).
6. Users can connect Strava via OAuth and auto-upload treks.
7. Push notifications alert users of achievements, group invites, and weekly summaries.

---

## Testing Instructions

### 1. Leaderboard Test

```bash
cd backend
pytest tests/test_leaderboard.py -v
# Verify ranking by distance, correct period filtering
```

### 2. Achievement Award Test

```bash
pytest tests/test_achievements.py -v
# Create user → complete 1 trek → check "First Steps" awarded
# Complete 10 km total → check "10K Trekker" awarded
```

### 3. Infographic Generation Test

```bash
curl -o infographic.png "http://localhost:8000/sessions/<ID>/infographic" \
  -H "Authorization: Bearer <TOKEN>"
# Open infographic.png — verify it's a 1080x1350 PNG with stats and route
```

### 4. Strava Integration Test

- Navigate to Integrations screen → tap "Connect Strava"
- Complete OAuth flow → verify token stored
- Complete a trek → verify activity appears in Strava

### 5. Push Notification Test

- Ensure FCM token is registered on backend
- Trigger an achievement → verify push notification received on device
