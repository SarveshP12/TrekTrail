# Phase 3: Core Backend Features

## Phase Title

**Core Backend Features — Authentication, Session Management, and REST API**

---

## Objective

Build the complete REST API layer for user authentication (registration, login, JWT), trek session lifecycle (start, upload points, end, summary), user profile management, elevation lookup, and trek history. After this phase, the backend is fully functional — a client can register, authenticate, create trek sessions, upload GPS data, retrieve computed summaries, and export tracks.

---

## Features Implemented in This Phase

- User registration with password hashing (bcrypt)
- User login with JWT access token issuance
- JWT-based authentication middleware for protected routes
- User profile retrieval and update
- Trek session lifecycle: start → upload GPS points → end → compute summary
- Trek session summary computation (distance, elevation, duration, calories)
- GPS track retrieval as GeoJSON
- Trek history with pagination, search, and filtering
- Elevation lookup endpoint (proxy to OpenTopoData API)
- GPX and KML file export
- Input validation and error responses on all endpoints

---

## Tasks Breakdown

* Task 1: Implement password hashing utility (bcrypt)
* Task 2: Implement JWT token creation and verification utilities
* Task 3: Build `POST /auth/register` endpoint
* Task 4: Build `POST /auth/login` endpoint
* Task 5: Create the `get_current_user` FastAPI dependency (JWT auth middleware)
* Task 6: Build `GET /users/{id}/profile` and `PUT /users/{id}/profile` endpoints
* Task 7: Build `POST /sessions/start` endpoint
* Task 8: Build `POST /sessions/{id}/points` endpoint (batch GPS point upload)
* Task 9: Build `POST /sessions/{id}/end` endpoint with stats computation service
* Task 10: Build the trek stats computation service (3D distance, elevation gain/loss, duration, calories)
* Task 11: Build `GET /sessions/{id}/summary` endpoint
* Task 12: Build `GET /sessions/{id}/track` endpoint (GeoJSON format)
* Task 13: Build `GET /sessions/{id}/export` endpoint (GPX/KML generation)
* Task 14: Build `GET /users/{id}/history` endpoint with pagination and filters
* Task 15: Build `GET /elevation/lookup` endpoint (proxy to DEM API)
* Task 16: Write integration tests for all endpoints

---

## File Structure for This Phase

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # Updated: mount API routers
│   ├── config.py
│   ├── database.py
│   ├── redis_client.py
│   ├── exceptions.py
│   ├── models/                          # From Phase 2 (unchanged)
│   │   └── ...
│   ├── schemas/                         # From Phase 2 + new additions
│   │   ├── ...
│   │   ├── auth.py                      # Login request/response, token schema
│   │   └── export.py                    # Export request schema
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py                    # Central router aggregator
│   │   ├── deps.py                      # Shared dependencies (get_current_user)
│   │   ├── auth.py                      # /auth/register, /auth/login
│   │   ├── users.py                     # /users/{id}/profile
│   │   ├── sessions.py                  # /sessions/* endpoints
│   │   └── elevation.py                 # /elevation/lookup
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py              # Password hashing, JWT utils
│   │   ├── user_service.py              # User CRUD operations
│   │   ├── session_service.py           # Trek session CRUD + stats computation
│   │   ├── gps_service.py              # GPS point storage and retrieval
│   │   ├── elevation_service.py         # DEM API client
│   │   └── export_service.py            # GPX/KML file generation
│   └── utils/
│       ├── __init__.py
│       ├── distance.py                  # 3D distance calculation
│       └── calories.py                  # Calorie estimation
├── tests/
│   ├── conftest.py                      # Updated: auth fixtures, test user factory
│   ├── test_auth.py                     # Auth endpoint tests
│   ├── test_users.py                    # User profile tests
│   ├── test_sessions.py                 # Session lifecycle tests
│   ├── test_elevation.py                # Elevation lookup tests
│   └── test_export.py                   # Export tests
├── ...
```

---

## Implementation Guide

### Task 1 — Password Hashing Utility

`backend/app/services/auth_service.py`:

```python
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(user_id: str, expires_minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.jwt_expiry_minutes
    )
    payload = {"sub": user_id, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
```

Add to `backend/requirements.txt`:

```
bcrypt==4.1.2
PyJWT==2.8.0
```

Update `backend/app/config.py` to add:

```python
jwt_algorithm: str = "HS256"
jwt_expiry_minutes: int = 1440  # 24 hours
opentopodata_api_url: str = "https://api.opentopodata.org/v1/srtm90m"
```

### Task 2–5 — Auth Endpoints and JWT Middleware

`backend/app/schemas/auth.py`:

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
```

`backend/app/services/user_service.py`:

```python
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth_service import hash_password
from app.exceptions import ConflictException, NotFoundException


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    # Check for existing email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise ConflictException("A user with this email already exists")

    user = User(
        email=data.email,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User")
    return user


async def update_user(db: AsyncSession, user_id: UUID, data: UserUpdate) -> User:
    user = await get_user_by_id(db, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user
```

`backend/app/api/deps.py`:

```python
from uuid import UUID

from fastapi import Depends, Header

from app.database import get_db
from app.exceptions import UnauthorizedException
from app.services.auth_service import decode_access_token
from app.services.user_service import get_user_by_id


async def get_current_user(
    authorization: str = Header(..., description="Bearer <token>"),
    db=Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise UnauthorizedException("Invalid authorization header format")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except Exception:
        raise UnauthorizedException()

    return await get_user_by_id(db, user_id)
```

`backend/app/api/auth.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import UnauthorizedException
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import create_access_token, verify_password
from app.services.user_service import create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, data)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user_id=str(user.id))
```

### Task 6 — User Profile Endpoints

`backend/app/api/users.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.exceptions import ForbiddenException
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate
from app.services.user_service import get_user_by_id, update_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/profile", response_model=UserRead)
async def get_profile(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_user_by_id(db, user_id)


@router.put("/{user_id}/profile", response_model=UserRead)
async def update_profile(
    user_id: UUID,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != user_id:
        raise ForbiddenException("You can only update your own profile")
    return await update_user(db, user_id, data)
```

### Task 7–9 — Trek Session Lifecycle

`backend/app/services/session_service.py`:

```python
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ForbiddenException, NotFoundException
from app.models.trek_session import TrekSession
from app.services.gps_service import get_session_points
from app.utils.distance import compute_trek_stats


async def start_session(db: AsyncSession, user_id: UUID, activity_type: str) -> TrekSession:
    session = TrekSession(
        user_id=user_id,
        start_time=datetime.now(timezone.utc),
        activity_type=activity_type,
        status="active",
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_session(db: AsyncSession, session_id: UUID) -> TrekSession:
    result = await db.execute(select(TrekSession).where(TrekSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundException("Trek session")
    return session


async def end_session(
    db: AsyncSession, ts_db: AsyncSession, session_id: UUID, user_id: UUID
) -> TrekSession:
    session = await get_session(db, session_id)
    if session.user_id != user_id:
        raise ForbiddenException("You can only end your own session")

    session.end_time = datetime.now(timezone.utc)
    session.status = "completed"
    session.duration_seconds = int(
        (session.end_time - session.start_time).total_seconds()
    )

    # Compute stats from GPS points
    points = await get_session_points(ts_db, session_id)
    if points:
        stats = compute_trek_stats(points)
        session.distance_2d = stats["distance_2d"]
        session.distance_3d = stats["distance_3d"]
        session.elevation_gain = stats["elevation_gain"]
        session.elevation_loss = stats["elevation_loss"]
        session.max_altitude = stats["max_altitude"]
        session.min_altitude = stats["min_altitude"]
        session.calories_burned = stats["calories_burned"]
        session.difficulty_rating = stats["difficulty_rating"]
        session.avg_speed = stats["avg_speed"]

    await db.flush()
    await db.refresh(session)
    return session


async def get_user_history(
    db: AsyncSession, user_id: UUID, page: int = 1, page_size: int = 20
) -> tuple[list[TrekSession], int]:
    # Count total
    count_q = select(TrekSession).where(TrekSession.user_id == user_id)
    all_results = await db.execute(count_q)
    total = len(all_results.scalars().all())

    # Paginated query
    query = (
        select(TrekSession)
        .where(TrekSession.user_id == user_id)
        .order_by(TrekSession.start_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    sessions = result.scalars().all()
    return list(sessions), total
```

### Task 10 — 3D Distance and Stats Computation

`backend/app/utils/distance.py`:

```python
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


def distance_3d(lat1: float, lon1: float, alt1: float, lat2: float, lon2: float, alt2: float) -> float:
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

        d3d = distance_3d(p1["latitude"], p1["longitude"], alt1, p2["latitude"], p2["longitude"], alt2)
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
```

### Task 13 — GPX/KML Export Service

`backend/app/services/export_service.py`:

```python
from datetime import datetime
from io import BytesIO
from typing import Any
from xml.etree.ElementTree import Element, SubElement, tostring


def generate_gpx(session_name: str, points: list[dict[str, Any]]) -> bytes:
    """Generate a GPX XML file from GPS track points."""
    gpx = Element("gpx", version="1.1", creator="TrekTrack AI")
    gpx.set("xmlns", "http://www.topografix.com/GPX/1/1")

    trk = SubElement(gpx, "trk")
    name = SubElement(trk, "name")
    name.text = session_name

    trkseg = SubElement(trk, "trkseg")
    for pt in points:
        trkpt = SubElement(trkseg, "trkpt", lat=str(pt["latitude"]), lon=str(pt["longitude"]))
        if pt.get("altitude") is not None:
            ele = SubElement(trkpt, "ele")
            ele.text = str(pt["altitude"])
        time_el = SubElement(trkpt, "time")
        time_el.text = pt["time"].isoformat()

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(gpx, encoding="unicode").encode("utf-8")


def generate_kml(session_name: str, points: list[dict[str, Any]]) -> bytes:
    """Generate a KML file from GPS track points."""
    kml = Element("kml")
    kml.set("xmlns", "http://www.opengis.net/kml/2.2")

    doc = SubElement(kml, "Document")
    name = SubElement(doc, "name")
    name.text = session_name

    placemark = SubElement(doc, "Placemark")
    pm_name = SubElement(placemark, "name")
    pm_name.text = session_name

    linestring = SubElement(placemark, "LineString")
    altitude_mode = SubElement(linestring, "altitudeMode")
    altitude_mode.text = "absolute"

    coordinates = SubElement(linestring, "coordinates")
    coord_strings = []
    for pt in points:
        alt = pt.get("altitude") or 0
        coord_strings.append(f"{pt['longitude']},{pt['latitude']},{alt}")
    coordinates.text = " ".join(coord_strings)

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(kml, encoding="unicode").encode("utf-8")
```

### Task 14 — Session API Router

`backend/app/api/sessions.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db, get_ts_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.gps_point import GPSPointBatchUpload, GPSPointRead
from app.schemas.trek_session import TrekSessionCreate, TrekSessionRead, TrekSessionSummary
from app.services.export_service import generate_gpx, generate_kml
from app.services.gps_service import get_session_points, store_gps_points
from app.services.session_service import end_session, get_session, get_user_history, start_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=TrekSessionRead, status_code=201)
async def create_session(
    data: TrekSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await start_session(db, current_user.id, data.activity_type)
    return session


@router.post("/{session_id}/points", status_code=202)
async def upload_points(
    session_id: UUID,
    data: GPSPointBatchUpload,
    current_user: User = Depends(get_current_user),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    await store_gps_points(ts_db, session_id, data.points)
    return {"accepted": len(data.points)}


@router.post("/{session_id}/end", response_model=TrekSessionRead)
async def finish_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    return await end_session(db, ts_db, session_id, current_user.id)


@router.get("/{session_id}/summary", response_model=TrekSessionRead)
async def get_summary(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_session(db, session_id)


@router.get("/{session_id}/track")
async def get_track(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    points = await get_session_points(ts_db, session_id)
    # Return as GeoJSON
    features = []
    for pt in points:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [pt["longitude"], pt["latitude"], pt.get("altitude")],
            },
            "properties": {"time": pt["time"].isoformat(), "speed": pt.get("speed")},
        })
    return {"type": "FeatureCollection", "features": features}


@router.get("/{session_id}/export")
async def export_track(
    session_id: UUID,
    format: str = Query("gpx", regex="^(gpx|kml)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ts_db: AsyncSession = Depends(get_ts_db),
):
    session = await get_session(db, session_id)
    points = await get_session_points(ts_db, session_id)
    name = f"TrekTrack_{session.start_time.strftime('%Y%m%d_%H%M')}"

    if format == "gpx":
        content = generate_gpx(name, points)
        media_type = "application/gpx+xml"
        filename = f"{name}.gpx"
    else:
        content = generate_kml(name, points)
        media_type = "application/vnd.google-earth.kml+xml"
        filename = f"{name}.kml"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

### Task 15 — Elevation Lookup

`backend/app/services/elevation_service.py`:

```python
import httpx

from app.config import settings
from app.redis_client import get_redis


async def lookup_elevation(latitude: float, longitude: float) -> float | None:
    """Look up elevation from OpenTopoData API with Redis caching."""
    cache_key = f"elev:{latitude:.5f}:{longitude:.5f}"

    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached is not None:
        return float(cached)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                settings.opentopodata_api_url,
                params={"locations": f"{latitude},{longitude}"},
            )
            resp.raise_for_status()
            data = resp.json()
            elevation = data["results"][0]["elevation"]
            if elevation is not None:
                await redis.setex(cache_key, 86400, str(elevation))  # Cache 24h
                return float(elevation)
    except Exception:
        pass
    return None
```

`backend/app/api/elevation.py`:

```python
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.services.elevation_service import lookup_elevation

router = APIRouter(prefix="/elevation", tags=["elevation"])


@router.get("/lookup")
async def get_elevation(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    current_user=Depends(get_current_user),
):
    elevation = await lookup_elevation(lat, lng)
    return {"latitude": lat, "longitude": lng, "elevation": elevation}
```

### Task 16 — Mount All Routers

`backend/app/api/router.py`:

```python
from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.elevation import router as elevation_router
from app.api.sessions import router as sessions_router
from app.api.users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(sessions_router)
api_router.include_router(elevation_router)
```

Update `backend/app/main.py` to include:

```python
from app.api.router import api_router
app.include_router(api_router)
```

---

## Dependencies

Add to `backend/requirements.txt`:

```
bcrypt==4.1.2
PyJWT==2.8.0
httpx==0.27.0
```

---

## Expected Output

After completing this phase:

1. A new user can register via `POST /auth/register` and login via `POST /auth/login` to receive a JWT.
2. Authenticated users can start a trek session, upload batches of GPS points, end the session (triggering automatic stats computation), and retrieve the summary.
3. Completed sessions can be exported as GPX or KML files.
4. Users can view paginated trek history.
5. Elevation lookup returns DEM data with Redis caching.
6. The OpenAPI docs at `/docs` show all available endpoints.

---

## Testing Instructions

### 1. End-to-End Manual Test

```bash
# Start server
cd backend && uvicorn app.main:app --reload --port 8000

# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"trekker@example.com","display_name":"Mountain Hiker","password":"securepass123"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"trekker@example.com","password":"securepass123"}'
# → Save the access_token from response

# Start session
curl -X POST http://localhost:8000/sessions/start \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"activity_type":"TREKKING"}'
# → Save session_id

# Upload GPS points
curl -X POST http://localhost:8000/sessions/<SESSION_ID>/points \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<SESSION_ID>",
    "points": [
      {"time":"2025-03-15T08:00:00Z","latitude":18.5204,"longitude":73.8567,"altitude":560},
      {"time":"2025-03-15T08:05:00Z","latitude":18.5210,"longitude":73.8575,"altitude":580},
      {"time":"2025-03-15T08:10:00Z","latitude":18.5220,"longitude":73.8590,"altitude":620}
    ]
  }'

# End session
curl -X POST http://localhost:8000/sessions/<SESSION_ID>/end \
  -H "Authorization: Bearer <TOKEN>"
# → Response includes computed distance_3d, elevation_gain, difficulty, etc.

# Export as GPX
curl -o trek.gpx "http://localhost:8000/sessions/<SESSION_ID>/export?format=gpx" \
  -H "Authorization: Bearer <TOKEN>"
```

### 2. Automated Tests

```bash
cd backend
pytest tests/ -v --tb=short

# Expected: all auth, session, and export tests pass
```

### 3. Verify OpenAPI Docs

Visit `http://localhost:8000/docs` — all endpoints should be visible with schemas.
