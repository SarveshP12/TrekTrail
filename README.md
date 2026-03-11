# TrekTrack AI

**AI-Enhanced Mobile Trek Tracking & Terrain-Aware Distance Measurement System**

[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue)]()
[![Version](https://img.shields.io/badge/Version-1.0-green)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

---

## Table of Contents

- [Project Description](#project-description)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation Guide](#installation-guide)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [AI / Algorithm Explanation](#ai--algorithm-explanation)
- [Example Workflow](#example-workflow)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [License](#license)

---

## Project Description

**TrekTrack AI** is an AI-enhanced mobile application that delivers accurate, terrain-aware distance measurement, intelligent activity classification, and rich analytics for outdoor trekkers — all within a mobile-first, offline-capable experience.

### Problem

Trekkers and hikers in mountainous and forested environments are underserved by existing navigation and fitness applications. Current solutions:

- Compute only **2D horizontal distances**, ignoring elevation changes
- **Misclassify trekking** as vehicular or cycling movement
- Cannot handle **GPS noise** introduced by dense canopy and rocky terrain

This results in inaccurate trek statistics, unreliable activity logs, and a poor user experience for the growing outdoor recreation market (exceeding $700 billion annually).

### Why TrekTrack AI?

No existing mobile application combines:

1. **3D Euclidean distance calculation** using real-time elevation data
2. **ML-based trekking activity classification** resistant to GPS noise
3. **Comprehensive terrain analytics**

...all within a single offline-capable smartphone application built specifically for trekkers.

---

## Features

### Core Tracking
- **Real-Time GPS Tracking** — Continuous GPS recording at configurable intervals (1s, 5s, 10s) with background tracking support
- **3D Distance Calculation** — Euclidean 3D distance formula incorporating elevation changes for true trekking effort
- **Offline Map Support** — Pre-downloadable map tiles (OpenStreetMap, SRTM elevation data) for navigation without mobile data
- **Live Map Rendering** — Real-time polyline rendering with position marker on map canvas

### AI & Intelligence
- **GPS Noise Filtering** — Kalman filter implementation for real-time positional smoothing with speed-based outlier rejection
- **Activity Classification** — ML classifier distinguishing trekking, running, cycling, driving, and stationary states with >95% accuracy
- **Terrain Analytics** — Real-time slope gradient calculation, elevation profile generation, and difficulty rating (Easy/Moderate/Hard/Expert)
- **Grade-Adjusted Pace (GAP)** — Slope-adjusted pace metrics for trail runners

### Data & Export
- **GPX/KML/JSON Export** — Full track export for GIS analysis
- **DEM Elevation Correction** — Altitude correction via Digital Elevation Model API integration
- **Post-Trek Analytics** — Smoothed re-computation of stats after noise removal
- **Offline Sync** — Batch sync of offline-recorded sessions when connectivity is restored

### User Experience
- **Trek Controls** — Start/pause/resume/stop with haptic and visual feedback
- **Waypoint Marking** — Custom labels and photo attachments at points of interest
- **In-Trek Stats Overlay** — Distance, elevation, time, and pace at a glance
- **Shareable Infographics** — Auto-generated trek summary cards for social media
- **Trek History** — Searchable, filterable, and sortable chronological history

### Social & Group
- **Group Trek Sessions** — Create/join guided group treks with live location sharing via WebSocket
- **Community Leaderboards** — Regional leaderboards for popular trekking areas
- **Health Platform Integration** — Sync with Apple Health, Google Fit, and Strava

### Admin & Management
- **Admin Dashboard** — App health monitoring, crash rates, and usage metrics
- **Content Moderation** — Tools for shared routes and community posts
- **Feature Flags** — Staged rollout system for new capabilities

---

## System Architecture

TrekTrack AI follows a **mobile-first, cloud-assisted architecture** with robust offline-first design.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MOBILE APPLICATION                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │  React Native │  │  MapLibre GL │  │  On-Device ML (TFLite /   │  │
│  │  UI Layer     │  │  Map Engine  │  │  Core ML)                 │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────────┬─────────────┘  │
│         │                 │                         │                │
│  ┌──────┴─────────────────┴─────────────────────────┴─────────────┐  │
│  │              SQLite + WatermelonDB (Local Store)               │  │
│  └───────────────────────────┬───────────────────────────────────-┘  │
└──────────────────────────────┼───────────────────────────────────────┘
                               │  REST / WebSocket
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          CLOUD BACKEND                               │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  FastAPI       │  │  Firebase Auth │  │  Socket.IO (Node.js)   │  │
│  │  (REST API)    │  │  (OAuth 2.0)   │  │  (Real-Time Groups)    │  │
│  └───────┬───────┘  └────────────────┘  └────────────────────────┘  │
│          │                                                           │
│  ┌───────┴──────────────────────────────────────────────────────┐    │
│  │                     DATA LAYER                                │    │
│  │  PostgreSQL │ TimescaleDB │ Redis │ S3 + CloudFront          │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                             │
│  OpenTopoData / SRTM  │  OpenWeatherMap  │  Apple HealthKit /       │
│  (Elevation API)       │  (Weather API)   │  Google Fit / Strava     │
└──────────────────────────────────────────────────────────────────────┘
```

### How Components Interact

1. **Mobile App** handles all real-time tracking, GPS filtering (Kalman filter), and ML inference on-device — no network required for core functionality.
2. **Cloud Backend** provides user authentication, session sync, analytics aggregation, social features (group sessions), and admin functions.
3. **Databases** — PostgreSQL stores user profiles and trek metadata; TimescaleDB handles GPS time-series data; Redis caches elevation lookups and session tokens; S3 stores GPX exports and images.
4. **External APIs** supply elevation data (DEM), weather forecasts, and health platform sync capabilities.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend (Mobile)** | React Native 0.73+ | Cross-platform iOS/Android UI |
| **Map Rendering** | MapLibre GL Native | Offline tile support, hardware-accelerated vector rendering |
| **On-Device ML** | TensorFlow Lite (Android) / Core ML (iOS) | Low-latency inference without network |
| **Local Database** | WatermelonDB + SQLite | High-performance offline-first reactive data layer |
| **Backend API** | FastAPI (Python) | High-performance async API with OpenAPI auto-docs |
| **Authentication** | Firebase Authentication | OAuth 2.0, social login, managed service |
| **Primary Database** | PostgreSQL 15 (AWS RDS) | ACID compliance, PostGIS for geospatial queries |
| **Time-Series DB** | TimescaleDB | Optimized for GPS time-series, auto-partitioning |
| **Cache** | Redis 7 (ElastiCache) | Sub-millisecond elevation lookups, session tokens |
| **Object Storage** | AWS S3 + CloudFront CDN | GPX exports, images, map tile delivery |
| **Real-Time** | Socket.IO on Node.js | Group session live location broadcasting |
| **ML Training** | Python + scikit-learn + XGBoost + TensorFlow | Industry-standard ML pipeline |
| **Cloud Platform** | AWS (ECS, RDS, S3, CloudFront, CloudWatch) | Managed services, auto-scaling |
| **CI/CD** | GitHub Actions + Fastlane | Automated testing, building, app store deployment |
| **Monitoring** | Datadog + Firebase Crashlytics + Sentry | Full-stack observability, real-time alerting |
| **Analytics** | Mixpanel | User behavior tracking, funnel analysis, cohort retention |

---

## Project Structure

```
trektrack-ai/
├── mobile/                          # React Native mobile application
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── screens/                 # App screens (Home, Map, History, Profile, etc.)
│   │   ├── navigation/              # React Navigation setup (bottom tabs, stacks)
│   │   ├── services/
│   │   │   ├── gps/                 # GPS tracking engine, Kalman filter
│   │   │   ├── ml/                  # On-device ML inference (TFLite/CoreML)
│   │   │   ├── maps/                # MapLibre integration, offline tile manager
│   │   │   ├── sync/                # Cloud sync and offline queue
│   │   │   └── analytics/           # Event tracking (Mixpanel)
│   │   ├── models/                  # Data models (Trek, Session, User, GPS Point)
│   │   ├── store/                   # State management
│   │   ├── utils/                   # 3D distance calculation, terrain analytics
│   │   └── assets/                  # Icons, images, fonts
│   ├── android/                     # Android-specific native code
│   ├── ios/                         # iOS-specific native code
│   └── __tests__/                   # Mobile unit and integration tests
│
├── backend/                         # Cloud backend services
│   ├── app/
│   │   ├── api/                     # FastAPI route handlers
│   │   │   ├── auth.py              # Registration, login, JWT
│   │   │   ├── sessions.py          # Trek session CRUD, GPS point upload
│   │   │   ├── elevation.py         # DEM elevation lookup
│   │   │   ├── groups.py            # Group session management
│   │   │   └── users.py             # User profile and history
│   │   ├── models/                  # SQLAlchemy / ORM models
│   │   ├── services/                # Business logic layer
│   │   ├── ml/                      # Server-side analytics and model serving
│   │   └── config.py                # App configuration and env vars
│   ├── migrations/                  # Database migration scripts
│   ├── tests/                       # Backend unit and integration tests
│   └── Dockerfile                   # Container definition
│
├── realtime/                        # Real-time WebSocket server
│   ├── src/
│   │   ├── server.js                # Socket.IO server setup
│   │   ├── handlers/                # Event handlers (location, session, group)
│   │   └── middleware/              # Auth middleware for WebSocket
│   └── package.json
│
├── ml/                              # ML training pipeline
│   ├── notebooks/                   # Jupyter notebooks for EDA and experiments
│   ├── data/                        # Training datasets
│   ├── models/                      # Trained model artifacts
│   ├── training/                    # Training scripts (XGBoost, LSTM)
│   └── evaluation/                  # Model evaluation and metrics
│
├── infrastructure/                  # Infrastructure as Code
│   ├── terraform/                   # AWS resource definitions
│   ├── docker-compose.yml           # Local development environment
│   └── .github/workflows/           # CI/CD pipeline definitions
│
├── docs/                            # Documentation
│   ├── api/                         # API documentation
│   ├── architecture/                # Architecture diagrams
│   └── onboarding/                  # Developer onboarding guide
│
├── .env.example                     # Environment variable template
├── README.md                        # This file
└── LICENSE
```

---

## Installation Guide

### Prerequisites

- **Node.js** >= 18.x
- **Python** >= 3.10
- **React Native CLI** and development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** (optional, for containerized setup)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/trektrack-ai.git
cd trektrack-ai
```

### 2. Mobile App Setup

```bash
cd mobile
npm install

# iOS only
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on device/emulator
npm run android   # For Android
npm run ios       # For iOS
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate    # Linux/Mac
venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 4. Real-Time Server Setup

```bash
cd realtime
npm install
npm start     # Starts Socket.IO server on port 3001
```

### 5. Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/trektrack
TIMESCALE_URL=postgresql://user:password@localhost:5433/trektrack_ts
REDIS_URL=redis://localhost:6379

# Authentication
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_API_KEY=your-firebase-api-key
JWT_SECRET=your-jwt-secret

# External APIs
OPENTOPODATA_API_URL=https://api.opentopodata.org/v1
OPENWEATHERMAP_API_KEY=your-openweathermap-key

# AWS
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=trektrack-exports
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=your-sentry-dsn
MIXPANEL_TOKEN=your-mixpanel-token
```

### 6. Docker (Alternative)

```bash
docker-compose up -d
```

This starts PostgreSQL, TimescaleDB, Redis, the backend API, and the real-time server.

---

## Usage

### Starting a Trek

1. Open the app and tap **Quick Start** on the Home screen, or navigate to the **Map** tab for advanced configuration.
2. The app acquires a GPS fix (< 2 seconds) and begins recording your path in real-time.
3. View live stats (3D distance, elevation, time, pace) on the map overlay.
4. Mark **waypoints** at points of interest with custom labels and photos.
5. Use **Pause/Resume** controls as needed during rest stops.

### Completing a Trek

1. Tap **Stop** to end the session.
2. The app runs post-trek processing: Gaussian smoothing, DEM altitude correction, and full stats recomputation.
3. View the **Trek Summary** — total 3D distance, elevation gain, highest point, duration, calories burned, difficulty rating, and elevation profile chart.
4. **Share** the auto-generated infographic to social media or **export** as GPX/KML/JSON.

### Group Sessions

1. A trek guide creates a group session from the **Groups** tab.
2. Members join using a session code.
3. Live locations are broadcast in real-time via WebSocket — all members appear on each other's maps.

### Offline Usage

1. Pre-download map tiles for your region from **Settings > Offline Maps**.
2. All core features (tracking, 3D distance, AI classification, map display) work fully offline.
3. Sessions sync automatically to the cloud when connectivity is restored.

---

## API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Authenticate user, return JWT |

### Trek Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions/start` | Initialize a new trek session, returns `session_id` |
| `POST` | `/sessions/{id}/points` | Batch upload GPS points (offline sync) |
| `POST` | `/sessions/{id}/end` | Finalize session, trigger server-side analytics |
| `GET` | `/sessions/{id}/summary` | Get computed stats for a completed session |
| `GET` | `/sessions/{id}/track` | Download full GPS track as GeoJSON |
| `GET` | `/sessions/{id}/export` | Export track as GPX or KML file |

### Users & History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/{id}/profile` | Retrieve user profile and preferences |
| `GET` | `/users/{id}/history` | Paginated list of past trek sessions |

### Elevation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/elevation/lookup` | Get DEM elevation for lat/lng point or array |

### Group Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/groups/create` | Create a guided group trek session |
| `POST` | `/groups/{id}/join` | Join an existing group trek session |
| `GET` | `/groups/{id}/locations` | WebSocket endpoint for real-time member locations |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `location:update` | Client → Server | `{ session_id, lat, lng, alt, timestamp }` |
| `location:broadcast` | Server → Clients | `{ user_id, lat, lng, alt, timestamp }` |
| `session:status` | Server → Client | `{ status: 'active' \| 'paused' \| 'ended' }` |
| `member:joined` | Server → Clients | `{ user_id, display_name, avatar_url }` |

> All endpoints (except `/auth/*`) require a valid JWT in the `Authorization: Bearer <token>` header.

---

## AI / Algorithm Explanation

### 1. GPS Noise Filtering — Kalman Filter

A standard **linear Kalman filter** runs on-device with state vector `[latitude, longitude, velocity_lat, velocity_lon]`.

- **Process noise covariance** is tuned for pedestrian movement patterns
- **Measurement noise covariance** is dynamically adjusted based on the GPS accuracy radius reported by the device OS
- **Speed-based outlier rejection** removes points implying > 50 km/h (physically impossible for trekking)
- **Post-trek Gaussian smoothing** pass applied before final analytics computation

### 2. Activity Classification Model

**Phase 1:** Gradient Boosted Trees (XGBoost)
**Phase 2:** LSTM-based sequence model for temporal movement pattern capture

**Input Features (computed over 30-second sliding windows):**

| Feature | Description |
|---------|-------------|
| GPS Speed | Mean and std dev (km/h) |
| Elevation Change Rate | Mean and variance (m/min) |
| Pace Consistency | Coefficient of variation of inter-point intervals |
| Accelerometer | Magnitude and variance from IMU |
| GPS DOP | Dilution of precision as terrain proxy |

**Output Classes:** `TREKKING`, `TRAIL_RUNNING`, `CYCLING`, `DRIVING`, `STATIONARY`, `UNKNOWN`

**Training Data:** 10,000+ labeled sessions across all activity classes, with overrepresentation of mountainous and forested terrain. Data sourced from beta users (with consent) and public datasets (FitRec, Kaggle).

**Performance Targets:**
- Classification Accuracy: > 95%
- F1-score per class: > 0.92
- TREKKING vs DRIVING confusion rate: < 1%

### 3. Elevation Correction — Sensor Fusion

A hybrid elevation model blends three sources using a Kalman-variant fusion filter:

1. **Barometric altimeter** — Low noise, high precision for relative altitude changes
2. **GPS altitude** — Absolute reference with higher noise
3. **SRTM DEM** — Fallback and periodic correction source (30m resolution)

**Target:** Altitude RMSE < 8m vs. surveyed reference points.

### 4. 3D Distance Calculation

```
distance = sqrt((Δlat)² + (Δlon)² + (Δalt)²)
```

Computed incrementally for each filtered GPS point. Both horizontal-only and full 3D distances are tracked for comparison. Segment-level breakdowns enable detailed route analysis.

### 5. Terrain Analytics

- **Slope gradient** — Real-time calculation in percentage and degrees
- **Difficulty rating** — Algorithm classifies trail as Easy / Moderate / Hard / Expert based on total elevation gain, max slope, and distance
- **Grade-Adjusted Pace (GAP)** — Normalizes pace for slope to allow fair comparison across flat and steep segments

---

## Example Workflow

Here is a step-by-step example of a typical trek session:

```
1. USER opens TrekTrack AI
   └─> App acquires GPS fix (< 2 seconds)

2. USER taps "Start Trek"
   └─> Session created, GPS recording begins (configurable interval)
   └─> On-device Kalman filter starts processing raw GPS points

3. DURING THE TREK
   ├─> Raw GPS points stream into a ring buffer (1000-point capacity)
   ├─> Kalman filter smooths each incoming point in real-time
   ├─> Outlier detection removes jumps exceeding 50 km/h
   ├─> 3D distance increments computed per filtered point
   ├─> Activity classifier runs on sliding 30s windows → "TREKKING" (97% confidence)
   ├─> Live map renders polyline with current position
   └─> Stats overlay updates: 3D Distance: 8.4 km | Elevation Gain: 620m | Time: 2h 15m

4. USER marks a waypoint at a scenic viewpoint
   └─> GPS coordinates + label + photo saved locally

5. USER taps "Stop Trek"
   └─> Post-trek processing begins:
       ├─> Gaussian smoothing pass on full track
       ├─> DEM altitude correction via API (or cached SRTM tiles if offline)
       └─> Full stats recomputation with corrected data

6. TREK SUMMARY displayed:
   ├─> Total 3D Distance: 14.2 km (vs. 11.8 km 2D)
   ├─> Elevation Gain: 1,240m | Max Altitude: 2,850m
   ├─> Difficulty: Hard | Duration: 5h 32m
   ├─> Grade-Adjusted Pace: 8:15 /km
   └─> Calories Burned: 1,450 kcal

7. USER shares infographic to social media
   └─> Auto-generated summary card exported as image

8. ON CONNECTIVITY RESTORE (if trek was offline):
   └─> Processed track uploaded to cloud
   └─> Raw track retained locally for 30 days
   └─> Stats synced to Apple Health / Google Fit / Strava
```

---

## Future Improvements

| Enhancement | Description | Timeline |
|-------------|-------------|----------|
| **Augmented Reality Navigation** | AR trail waypoint overlays using phone camera for navigation at forks and summits | Year 2 |
| **Wearable Integration** | Full sync with Apple Watch, Wear OS, Garmin; heart rate + HRV analytics | Year 2 |
| **AI Route Recommendation** | Personalized trail suggestions based on fitness level, location, and past performance | Year 2 |
| **Safety SOS System** | One-tap emergency alert with last-known GPS location sent to emergency contacts | Year 1.5 |
| **Weather Micro-Forecast** | Hyperlocal weather warnings (storm, lightning) based on real-time route and elevation | Year 1.5 |
| **Offline AI Voice Assistant** | On-device voice assistant for hands-free trek queries and navigation commands | Year 3 |
| **B2B Guide Platform** | White-label version for commercial trekking operators with booking and fleet management | Year 2 |
| **Carbon Footprint Tracker** | Calculate and offset the carbon footprint of travel to/from trek starting points | Year 2 |
| **LSTM Model Upgrade** | Sequence model for activity classification capturing temporal movement patterns | Phase 3 |
| **International Expansion** | Multi-language support and region-specific trail databases | Phase 3 |

---

## Contributing

We welcome contributions from the community! Here's how to get started:

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit** your changes with clear messages:
   ```bash
   git commit -m "feat: add slope-adjusted pace display"
   ```
4. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** against the `main` branch

### Guidelines

- Follow existing code style and conventions
- Write tests for new features and bug fixes
- Update documentation for any API or behavior changes
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- Ensure all CI checks pass before requesting review

### Areas Where Help Is Needed

- ML model training with diverse terrain datasets
- Offline map tile optimization
- Accessibility improvements (WCAG 2.1 AA)
- Internationalization and translations
- Performance profiling on low-end devices

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>TrekTrack AI</strong> — Your definitive digital companion for outdoor trekking.
  <br>
  Built with ❤️ for the trekking community.
</p>
