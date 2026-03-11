# Phase 1: Project Setup and Environment Configuration

## Phase Title

**Project Setup and Environment Configuration**

---

## Objective

Establish the complete development environment, monorepo structure, CI/CD pipeline scaffolding, and local development tooling for TrekTrack AI. After this phase, every developer can clone the repository, run a single setup script, and have all services (mobile app, backend API, real-time server, ML workspace) running locally.

---

## Features Implemented in This Phase

- Monorepo initialization with organized workspace structure
- React Native mobile project bootstrapping (iOS + Android)
- FastAPI backend project scaffolding with async support
- Node.js real-time server (Socket.IO) scaffolding
- ML training workspace with Jupyter support
- Docker Compose for local PostgreSQL, TimescaleDB, and Redis
- ESLint, Prettier, Black, and isort linting configurations
- GitHub Actions CI pipeline skeleton (lint + type check)
- Environment variable management with `.env.example`
- EditorConfig and shared VS Code settings

---

## Tasks Breakdown

* Task 1: Initialize the Git repository with `.gitignore`, `LICENSE`, and root `README.md`
* Task 2: Create the monorepo folder structure (`mobile/`, `backend/`, `realtime/`, `ml/`, `infrastructure/`, `docs/`)
* Task 3: Bootstrap the React Native project inside `mobile/` using React Native CLI
* Task 4: Initialize the FastAPI project inside `backend/` with `pyproject.toml` and virtual environment
* Task 5: Initialize the Node.js Socket.IO project inside `realtime/` with `package.json`
* Task 6: Set up the ML workspace inside `ml/` with a Python virtual environment and Jupyter
* Task 7: Create `docker-compose.yml` with PostgreSQL 15, TimescaleDB, and Redis 7 services
* Task 8: Configure ESLint + Prettier for the mobile and realtime workspaces
* Task 9: Configure Black + isort + Ruff for the backend and ML workspaces
* Task 10: Create the `.env.example` template with all required environment variables
* Task 11: Set up GitHub Actions workflow for linting and type checking across all workspaces
* Task 12: Add EditorConfig and shared VS Code workspace settings
* Task 13: Write a root-level setup script (`scripts/setup.sh` / `scripts/setup.ps1`) that installs all dependencies

---

## File Structure for This Phase

```
trektrack-ai/
├── .github/
│   └── workflows/
│       └── ci-lint.yml                  # GitHub Actions: lint + type check
├── mobile/
│   ├── src/                             # Empty src directory (populated in later phases)
│   ├── android/                         # Android native project (auto-generated)
│   ├── ios/                             # iOS native project (auto-generated)
│   ├── __tests__/                       # Test directory
│   ├── index.js                         # React Native entry point
│   ├── app.json                         # React Native app config
│   ├── metro.config.js                  # Metro bundler config
│   ├── babel.config.js                  # Babel config
│   ├── tsconfig.json                    # TypeScript config
│   ├── .eslintrc.js                     # ESLint config
│   ├── .prettierrc                      # Prettier config
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                      # FastAPI entry point with health check
│   │   └── config.py                    # Pydantic settings loader
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_health.py               # Health endpoint test
│   ├── alembic/                         # Alembic migration directory (empty)
│   │   └── env.py
│   ├── alembic.ini
│   ├── pyproject.toml                   # Python project config (dependencies, linting)
│   ├── requirements.txt                 # Pinned dependencies
│   └── Dockerfile                       # Backend container definition
├── realtime/
│   ├── src/
│   │   └── server.js                    # Socket.IO server skeleton with health endpoint
│   ├── .eslintrc.js
│   ├── package.json
│   └── Dockerfile
├── ml/
│   ├── notebooks/
│   │   └── .gitkeep
│   ├── data/
│   │   └── .gitkeep
│   ├── models/
│   │   └── .gitkeep
│   ├── requirements.txt                 # ML Python dependencies
│   └── README.md                        # ML workspace instructions
├── infrastructure/
│   ├── docker-compose.yml               # Local dev: Postgres + TimescaleDB + Redis
│   └── .env.docker                      # Docker-specific env overrides
├── scripts/
│   ├── setup.sh                         # Unix setup script
│   └── setup.ps1                        # Windows setup script
├── docs/
│   └── phases/                          # Phase README files
├── .editorconfig
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## Implementation Guide

### Task 1 — Initialize Git Repository

```bash
mkdir trektrack-ai && cd trektrack-ai
git init
```

Create `.gitignore` covering Node, Python, React Native, and IDE artifacts:

```gitignore
# Node
node_modules/
npm-debug.log*
yarn-error.log*

# Python
__pycache__/
*.py[cod]
.venv/
venv/
*.egg-info/
dist/

# React Native
mobile/android/app/build/
mobile/ios/Pods/
mobile/ios/build/
*.hprof

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/settings.json
*.swp
*.swo

# Docker
infrastructure/.env.docker

# ML
ml/models/*.tflite
ml/models/*.pkl
ml/data/*.csv
ml/data/*.parquet

# OS
.DS_Store
Thumbs.db
```

### Task 2 — Create Monorepo Folder Structure

```bash
mkdir -p mobile/src mobile/__tests__
mkdir -p backend/app backend/tests backend/alembic
mkdir -p realtime/src
mkdir -p ml/notebooks ml/data ml/models
mkdir -p infrastructure
mkdir -p scripts
mkdir -p docs/phases
mkdir -p .github/workflows
```

### Task 3 — Bootstrap React Native Mobile App

```bash
cd mobile
npx react-native init TrekTrackAI --template react-native-template-typescript
# Move generated files into mobile/ root (flatten one level if nested)
```

Update `mobile/package.json` with initial dependencies:

```json
{
  "name": "trektrack-mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "react-native start",
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "jest"
  },
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.73.0",
    "typescript": "^5.3.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "@react-native/eslint-config": "^0.73.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.4.0"
  }
}
```

`mobile/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "commonjs",
    "lib": ["es2021"],
    "jsx": "react-native",
    "strict": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*", "__tests__/**/*"],
  "exclude": ["node_modules"]
}
```

### Task 4 — Initialize FastAPI Backend

`backend/pyproject.toml`:

```toml
[project]
name = "trektrack-backend"
version = "0.1.0"
requires-python = ">=3.10"

[tool.black]
line-length = 100
target-version = ["py310"]

[tool.isort]
profile = "black"
line_length = 100

[tool.ruff]
line-length = 100
target-version = "py310"
```

`backend/requirements.txt`:

```
fastapi==0.109.2
uvicorn[standard]==0.27.1
pydantic==2.6.1
pydantic-settings==2.1.0
python-dotenv==1.0.1
sqlalchemy[asyncio]==2.0.27
asyncpg==0.29.0
alembic==1.13.1
redis==5.0.1
httpx==0.27.0
pytest==8.0.1
pytest-asyncio==0.23.4
black==24.2.0
isort==5.13.2
ruff==0.2.2
```

`backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="TrekTrack AI API",
    version="0.1.0",
    description="Backend API for TrekTrack AI trek tracking system",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
```

`backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TrekTrack AI"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/trektrack"
    timescale_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/trektrack_ts"
    redis_url: str = "redis://localhost:6379"
    jwt_secret: str = "change-me-in-production"
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
```

`backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Task 5 — Initialize Real-Time Socket.IO Server

`realtime/package.json`:

```json
{
  "name": "trektrack-realtime",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "lint": "eslint src/"
  },
  "dependencies": {
    "socket.io": "^4.7.4",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.4.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.3",
    "eslint": "^8.56.0"
  }
}
```

`realtime/src/server.js`:

```javascript
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "realtime" });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.REALTIME_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
});
```

### Task 6 — Set Up ML Workspace

`ml/requirements.txt`:

```
numpy==1.26.4
pandas==2.2.0
scikit-learn==1.4.0
xgboost==2.0.3
tensorflow==2.15.0
matplotlib==3.8.3
seaborn==0.13.2
jupyterlab==4.1.1
```

### Task 7 — Docker Compose for Data Services

`infrastructure/docker-compose.yml`:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trektrack
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trektrack_ts
    ports:
      - "5433:5432"
    volumes:
      - tsdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  tsdata:
  redisdata:
```

### Task 8–9 — Linting Configurations

`mobile/.eslintrc.js`:

```javascript
module.exports = {
  root: true,
  extends: ["@react-native"],
  rules: {
    "react-native/no-inline-styles": "warn",
  },
};
```

`mobile/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Task 10 — Environment Variables

`.env.example`:

```env
# ── Database ───────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/trektrack
TIMESCALE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/trektrack_ts
REDIS_URL=redis://localhost:6379

# ── Auth ───────────────────────────────────────────────
FIREBASE_PROJECT_ID=
FIREBASE_API_KEY=
JWT_SECRET=change-me-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=1440

# ── External APIs ─────────────────────────────────────
OPENTOPODATA_API_URL=https://api.opentopodata.org/v1
OPENWEATHERMAP_API_KEY=
MAPBOX_ACCESS_TOKEN=

# ── AWS ────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=trektrack-exports
AWS_REGION=us-east-1

# ── Monitoring ─────────────────────────────────────────
SENTRY_DSN=
MIXPANEL_TOKEN=

# ── Realtime Server ───────────────────────────────────
REALTIME_PORT=3001
```

### Task 11 — GitHub Actions CI

`.github/workflows/ci-lint.yml`:

```yaml
name: CI — Lint & Type Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-lint:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install black isort ruff
      - run: black --check .
      - run: isort --check-only .
      - run: ruff check .

  mobile-lint:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run lint

  realtime-lint:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: realtime
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run lint
```

### Task 12 — EditorConfig

`.editorconfig`:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.py]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

### Task 13 — Setup Scripts

`scripts/setup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== TrekTrack AI: Full Development Setup ==="

# 1. Start data services
echo "\n[1/5] Starting Docker services (Postgres, TimescaleDB, Redis)..."
cd infrastructure && docker compose up -d && cd ..

# 2. Backend
echo "\n[2/5] Setting up backend..."
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Mobile
echo "\n[3/5] Setting up mobile app..."
cd mobile && npm install && cd ..

# 4. Realtime
echo "\n[4/5] Setting up realtime server..."
cd realtime && npm install && cd ..

# 5. ML
echo "\n[5/5] Setting up ML workspace..."
cd ml
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "\n.env file created from .env.example — update values as needed."
fi

echo "\n=== Setup complete! ==="
echo "Start backend:   cd backend && uvicorn app.main:app --reload"
echo "Start mobile:    cd mobile && npm start"
echo "Start realtime:  cd realtime && npm run dev"
```

---

## Dependencies

| Workspace | Key Dependencies |
|-----------|-----------------|
| **mobile** | react-native 0.73+, typescript 5.x, eslint, prettier, jest |
| **backend** | fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, pydantic-settings, alembic, redis, pytest |
| **realtime** | socket.io, express, jsonwebtoken, cors, nodemon |
| **ml** | numpy, pandas, scikit-learn, xgboost, tensorflow, jupyterlab |
| **infrastructure** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |

---

## Expected Output

After completing this phase:

1. Running `docker compose up -d` inside `infrastructure/` starts PostgreSQL (port 5432), TimescaleDB (port 5433), and Redis (port 6379).
2. Running `uvicorn app.main:app --reload` inside `backend/` serves the FastAPI app at `http://localhost:8000` with a working `/health` endpoint.
3. Running `npm run dev` inside `realtime/` starts the Socket.IO server at `http://localhost:3001` with a `/health` endpoint.
4. Running `npm start` inside `mobile/` launches the Metro bundler, and the app can be run on an Android/iOS emulator showing the default React Native screen.
5. All linters pass with zero errors.
6. The GitHub Actions CI pipeline runs lint checks on push.

---

## Testing Instructions

### 1. Verify Docker Services

```bash
cd infrastructure
docker compose up -d
docker compose ps          # All 3 services should be "healthy"

# Test PostgreSQL
docker exec -it infrastructure-postgres-1 psql -U postgres -c "SELECT 1;"

# Test Redis
docker exec -it infrastructure-redis-1 redis-cli ping   # → PONG
```

### 2. Verify Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# In another terminal:
curl http://localhost:8000/health
# Expected: {"status":"healthy","version":"0.1.0"}

# Run tests
pytest tests/
```

### 3. Verify Realtime Server

```bash
cd realtime
npm install
npm run dev

# In another terminal:
curl http://localhost:3001/health
# Expected: {"status":"healthy","service":"realtime"}
```

### 4. Verify Mobile App

```bash
cd mobile
npm install

# Android
npm run android

# iOS (macOS only)
cd ios && pod install && cd ..
npm run ios
```

### 5. Verify Linting

```bash
# Backend
cd backend && black --check . && isort --check-only . && ruff check .

# Mobile
cd mobile && npm run lint

# Realtime
cd realtime && npm run lint
```
