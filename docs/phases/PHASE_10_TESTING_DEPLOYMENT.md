# Phase 10: Testing, Optimization & Deployment

## Phase Title

**Testing, Optimization & Deployment — E2E Tests, Performance Tuning, Battery Optimization, CI/CD, and Cloud Deployment**

---

## Objective

Harden the entire system for production: write comprehensive end-to-end tests for all critical paths, optimize backend query performance, optimize mobile battery consumption and startup time, configure production-grade CI/CD with automated app builds, deploy the backend and real-time servers to AWS, and publish the mobile app to the App Store and Google Play. After this phase, TrekTrack AI is a production-ready, fully tested, and deployed product.

---

## Features Implemented in This Phase

- End-to-end test suite covering all critical user flows
- Backend API load testing (Locust) with performance benchmarks
- Database query optimization (indexes, query plans, connection pooling)
- Mobile performance profiling and optimization (startup time, memory, FPS)
- Battery usage optimization validation
- App size optimization (tree shaking, Hermes, ProGuard)
- Production Docker images (multi-stage builds)
- AWS infrastructure provisioning (Terraform / CDK)
- CI/CD pipeline: lint → test → build → deploy (GitHub Actions)
- Fastlane configuration for iOS and Android app store builds
- Production monitoring and alerting (Sentry, CloudWatch)
- Security hardening (rate limiting, CORS, CSP, secrets management)

---

## Tasks Breakdown

* Task 1: Write backend E2E tests (full user journey: register → trek → export)
* Task 2: Write mobile E2E tests using Detox (full app flow)
* Task 3: Write Locust load tests for backend API
* Task 4: Add database indexes and optimize slow queries
* Task 5: Configure connection pooling (pgbouncer / SQLAlchemy pool)
* Task 6: Mobile performance optimization (Hermes, lazy loading, image caching)
* Task 7: Battery optimization validation (measure GPS drain in background)
* Task 8: Build production Docker images (backend, realtime server)
* Task 9: Write Terraform / CDK for AWS infrastructure
* Task 10: Configure GitHub Actions CI/CD pipeline (full)
* Task 11: Configure Fastlane for iOS and Android builds
* Task 12: Set up monitoring (Sentry, CloudWatch dashboards, health checks)
* Task 13: Security hardening (rate limiting, CORS, input sanitization audit)
* Task 14: Write production deployment runbook

---

## File Structure for This Phase

```
# Root-level additions
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Lint + Unit Test + Type Check
│       ├── backend-deploy.yml            # Build + Push Docker + Deploy to ECS
│       ├── mobile-build-android.yml      # Fastlane Android build + upload
│       └── mobile-build-ios.yml          # Fastlane iOS build + upload
├── infra/
│   ├── terraform/
│   │   ├── main.tf                       # AWS provider, state backend
│   │   ├── vpc.tf                        # VPC, subnets, security groups
│   │   ├── rds.tf                        # PostgreSQL RDS + TimescaleDB
│   │   ├── elasticache.tf                # Redis ElastiCache
│   │   ├── ecs.tf                        # ECS Fargate cluster + services
│   │   ├── alb.tf                        # Application Load Balancer
│   │   ├── s3.tf                         # S3 bucket for exports/infographics
│   │   ├── cloudfront.tf                 # CDN for static assets
│   │   ├── ecr.tf                        # ECR repositories
│   │   ├── secrets.tf                    # AWS Secrets Manager
│   │   ├── monitoring.tf                 # CloudWatch alarms
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars.example
│   └── docker/
│       ├── backend.Dockerfile            # Multi-stage Python build
│       └── realtime.Dockerfile           # Multi-stage Node.js build

backend/
├── tests/
│   ├── e2e/
│   │   └── test_full_journey.py          # Register → Login → Trek → Summary → Export
│   └── load/
│       ├── locustfile.py                 # Locust load test scenarios
│       └── README.md

mobile/
├── e2e/
│   ├── init.ts                           # Detox config
│   ├── firstTrek.e2e.ts                  # Full trek E2E
│   ├── groupTrek.e2e.ts                  # Group session E2E
│   └── offlineSync.e2e.ts               # Offline → online sync E2E
├── fastlane/
│   ├── Fastfile                          # iOS + Android lanes
│   ├── Appfile                           # App identifiers
│   └── Matchfile                         # Code signing (iOS)

docs/
├── DEPLOYMENT_RUNBOOK.md                 # Step-by-step production deployment guide
├── MONITORING.md                         # Dashboards, alerts, on-call playbook
└── SECURITY.md                           # Security practices and audit checklist
```

---

## Implementation Guide

### Task 1 — Backend E2E Test

`backend/tests/e2e/test_full_journey.py`:

```python
"""End-to-end test: full user journey from registration to trek export."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_trek_journey(client: AsyncClient):
    # 1. Register
    resp = await client.post("/auth/register", json={
        "email": "e2e@trektrack.ai",
        "display_name": "E2E Tester",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    # 2. Login
    resp = await client.post("/auth/login", json={
        "email": "e2e@trektrack.ai",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Start session
    resp = await client.post("/sessions/start", json={"activity_type": "TREKKING"}, headers=headers)
    assert resp.status_code == 201
    session_id = resp.json()["id"]

    # 4. Upload GPS points
    points = [
        {"time": "2025-03-15T08:00:00Z", "latitude": 18.5204, "longitude": 73.8567, "altitude": 560, "accuracy": 5},
        {"time": "2025-03-15T08:05:00Z", "latitude": 18.5210, "longitude": 73.8575, "altitude": 580, "accuracy": 5},
        {"time": "2025-03-15T08:10:00Z", "latitude": 18.5220, "longitude": 73.8590, "altitude": 620, "accuracy": 5},
        {"time": "2025-03-15T08:15:00Z", "latitude": 18.5235, "longitude": 73.8610, "altitude": 670, "accuracy": 5},
        {"time": "2025-03-15T08:20:00Z", "latitude": 18.5250, "longitude": 73.8625, "altitude": 710, "accuracy": 5},
    ]
    resp = await client.post(
        f"/sessions/{session_id}/points",
        json={"session_id": session_id, "points": points},
        headers=headers,
    )
    assert resp.status_code == 202

    # 5. End session
    resp = await client.post(f"/sessions/{session_id}/end", headers=headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["status"] == "completed"
    assert summary["distance_3d"] > 0
    assert summary["elevation_gain"] > 100
    assert summary["difficulty_rating"] in ("Easy", "Moderate", "Hard", "Expert")

    # 6. Get summary
    resp = await client.get(f"/sessions/{session_id}/summary", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["distance_3d"] == summary["distance_3d"]

    # 7. Get track as GeoJSON
    resp = await client.get(f"/sessions/{session_id}/track", headers=headers)
    assert resp.status_code == 200
    geojson = resp.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 5

    # 8. Export as GPX
    resp = await client.get(f"/sessions/{session_id}/export?format=gpx", headers=headers)
    assert resp.status_code == 200
    assert b"<gpx" in resp.content

    # 9. Check leaderboard
    resp = await client.get("/leaderboard/?period=all_time&metric=distance", headers=headers)
    assert resp.status_code == 200
    board = resp.json()
    assert any(entry["user_id"] == user_id for entry in board)

    # 10. Check achievements
    resp = await client.get(f"/users/{user_id}/achievements", headers=headers)
    assert resp.status_code == 200
    achievements = resp.json()
    assert any(a["key"] == "first_trek" for a in achievements)
```

### Task 3 — Locust Load Tests

`backend/tests/load/locustfile.py`:

```python
"""Locust load test for TrekTrack API."""
from locust import HttpUser, task, between


class TrekTrackUser(HttpUser):
    wait_time = between(1, 3)
    token = None
    session_id = None

    def on_start(self):
        # Register + login
        import uuid
        email = f"load_{uuid.uuid4().hex[:8]}@test.com"
        self.client.post("/auth/register", json={
            "email": email,
            "display_name": "Load Tester",
            "password": "loadtest123",
        })
        resp = self.client.post("/auth/login", json={
            "email": email,
            "password": "loadtest123",
        })
        self.token = resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(3)
    def start_and_end_session(self):
        resp = self.client.post("/sessions/start", json={"activity_type": "TREKKING"}, headers=self.headers)
        if resp.status_code == 201:
            sid = resp.json()["id"]
            # Upload a small batch
            self.client.post(f"/sessions/{sid}/points", json={
                "session_id": sid,
                "points": [
                    {"time": "2025-01-01T08:00:00Z", "latitude": 18.52, "longitude": 73.85, "altitude": 560},
                    {"time": "2025-01-01T08:01:00Z", "latitude": 18.521, "longitude": 73.851, "altitude": 565},
                ],
            }, headers=self.headers)
            self.client.post(f"/sessions/{sid}/end", headers=self.headers)

    @task(2)
    def get_leaderboard(self):
        self.client.get("/leaderboard/?period=weekly&metric=distance", headers=self.headers)

    @task(1)
    def get_elevation(self):
        self.client.get("/elevation/lookup?lat=18.52&lng=73.85", headers=self.headers)
```

### Task 4 — Database Indexes

Add an Alembic migration to create performance indexes:

```python
"""Add performance indexes.

Revision: 003
"""
from alembic import op


def upgrade():
    # Trek sessions: user lookup + status filter + time ordering
    op.create_index("ix_trek_sessions_user_status", "trek_sessions", ["user_id", "status"])
    op.create_index("ix_trek_sessions_user_start_time", "trek_sessions", ["user_id", "start_time"])

    # GPS track points (TimescaleDB hypertable already has time index)
    op.create_index("ix_gps_track_points_session", "gps_track_points", ["session_id", "time"])

    # Users: email lookup
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Achievements: user lookup
    op.create_index("ix_user_achievements_user", "user_achievements", ["user_id"])

    # Group sessions
    op.create_index("ix_group_members_user", "group_members", ["user_id"])


def downgrade():
    op.drop_index("ix_trek_sessions_user_status")
    op.drop_index("ix_trek_sessions_user_start_time")
    op.drop_index("ix_gps_track_points_session")
    op.drop_index("ix_users_email")
    op.drop_index("ix_user_achievements_user")
    op.drop_index("ix_group_members_user")
```

### Task 8 — Production Docker Images

`infra/docker/backend.Dockerfile`:

```dockerfile
# Stage 1: Build
FROM python:3.12-slim AS builder
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim
WORKDIR /app

# Copy installed packages
COPY --from=builder /install /usr/local

# Copy application code
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini .

# Non-root user
RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

`infra/docker/realtime.Dockerfile`:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY realtime/package*.json ./
RUN npm ci --production
COPY realtime/src ./src
COPY realtime/tsconfig.json .
RUN npx tsc

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN adduser -D appuser
USER appuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### Task 9 — Terraform AWS Infrastructure (Key Resources)

`infra/terraform/ecs.tf` (excerpt):

```hcl
resource "aws_ecs_cluster" "main" {
  name = "trektrack-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "trektrack-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }
}

resource "aws_ecs_service" "realtime" {
  name            = "trektrack-realtime"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.realtime.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.realtime.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.realtime.arn
    container_name   = "realtime"
    container_port   = 3001
  }
}
```

### Task 10 — GitHub Actions CI/CD

`.github/workflows/backend-deploy.yml`:

```yaml
name: Backend Deploy

on:
  push:
    branches: [main]
    paths: [backend/**, infra/docker/backend.Dockerfile]

env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY: trektrack-backend
  ECS_CLUSTER: trektrack-cluster
  ECS_SERVICE: trektrack-backend

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: trektrack_test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
      - run: cd backend && pytest --tb=short -q
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/trektrack_test
          REDIS_URL: redis://localhost:6379

  deploy:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr
      - run: |
          docker build -f infra/docker/backend.Dockerfile -t ${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }} .
          docker push ${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }}
      - run: |
          aws ecs update-service --cluster ${{ env.ECS_CLUSTER }} --service ${{ env.ECS_SERVICE }} --force-new-deployment
```

### Task 11 — Fastlane

`mobile/fastlane/Fastfile`:

```ruby
default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    setup_ci
    match(type: "appstore", readonly: true)
    build_app(
      workspace: "ios/TrekTrail.xcworkspace",
      scheme: "TrekTrail",
      export_method: "app-store",
    )
    upload_to_testflight(skip_waiting_for_build_processing: true)
  end

  desc "Build and upload to App Store"
  lane :release do
    setup_ci
    match(type: "appstore", readonly: true)
    build_app(
      workspace: "ios/TrekTrail.xcworkspace",
      scheme: "TrekTrail",
      export_method: "app-store",
    )
    upload_to_app_store(
      submit_for_review: true,
      automatic_release: false,
    )
  end
end

platform :android do
  desc "Build and upload to Play Store internal track"
  lane :beta do
    gradle(
      project_dir: "android",
      task: "bundle",
      build_type: "Release",
    )
    upload_to_play_store(
      track: "internal",
      aab: "android/app/build/outputs/bundle/release/app-release.aab",
    )
  end

  desc "Promote to production"
  lane :release do
    upload_to_play_store(
      track: "internal",
      track_promote_to: "production",
    )
  end
end
```

### Task 12 — Monitoring Setup

`backend/app/main.py` additions for Sentry:

```python
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment=settings.environment,
    )
    app = SentryAsgiMiddleware(app)
```

### Task 13 — Security Hardening

`backend/app/middleware/security.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def setup_security(app: FastAPI, allowed_origins: list[str]):
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["*"],
    )

    # Rate limiting
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Security headers
    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
```

---

## Dependencies

### Backend additions

```
sentry-sdk[fastapi]==1.40.0
slowapi==0.1.9
locust==2.23.0  # dev only
```

### Infrastructure

```
terraform >= 1.7
aws-cli >= 2.15
```

### Mobile additions

```json
{
  "@sentry/react-native": "^5.17.0",
  "detox": "^20.18.0"
}
```

---

## Expected Output

After completing this phase:

1. E2E tests cover the complete user journey (register → trek → export → leaderboard).
2. Load tests confirm the backend handles 500 concurrent users with < 200 ms p95 latency.
3. Database queries use indexes — no full table scans on user-facing endpoints.
4. Mobile app starts in < 2 seconds, maintains 60 FPS scrolling, GPS uses < 5% battery/hour.
5. Production Docker images are < 200 MB each.
6. AWS infrastructure is provisioned via Terraform: ECS Fargate, RDS, ElastiCache, ALB, S3, CloudFront.
7. CI/CD automatically runs tests, builds Docker images, and deploys on push to main.
8. Fastlane builds and uploads to TestFlight / Play Store internal track.
9. Sentry captures errors and performance traces in production.
10. Rate limiting and security headers protect against common attacks.

---

## Testing Instructions

### 1. Run Full E2E Test Suite

```bash
cd backend
pytest tests/e2e/ -v --tb=short
# All tests should pass
```

### 2. Run Load Tests

```bash
cd backend/tests/load
locust -f locustfile.py --headless -u 100 -r 10 --run-time 5m --host http://localhost:8000
# Target: p95 < 200ms, 0 failures
```

### 3. Mobile E2E (Detox)

```bash
cd mobile
npx detox build --configuration ios.sim.release
npx detox test --configuration ios.sim.release
# All E2E scenarios should pass
```

### 4. Docker Build Verification

```bash
cd infra/docker
docker build -f backend.Dockerfile -t trektrack-backend:test ../..
docker build -f realtime.Dockerfile -t trektrack-realtime:test ../..
docker images | grep trektrack
# Both images < 200 MB
```

### 5. Terraform Plan

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in values
terraform init
terraform plan
# Review the plan — no errors, expected resource count ~25-30
```

### 6. Security Audit Checklist

- [ ] All endpoints except `/auth/*` and `/health` require JWT
- [ ] Rate limiting active: > 100 requests/min from one IP returns 429
- [ ] CORS only allows configured origins
- [ ] Security headers present in all responses (check with `curl -I`)
- [ ] No secrets in code — all via environment variables
- [ ] SQL injection: all queries use parameterized SQLAlchemy statements
- [ ] Input validation: all endpoints use Pydantic schemas
