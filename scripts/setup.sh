#!/usr/bin/env bash
set -euo pipefail

echo "=== TrekTrack AI: Full Development Setup ==="

# 1. Start data services
echo ""
echo "[1/5] Starting Docker services (Postgres, TimescaleDB, Redis)..."
cd infrastructure && docker compose up -d && cd ..

# 2. Backend
echo ""
echo "[2/5] Setting up backend..."
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Mobile
echo ""
echo "[3/5] Setting up mobile app..."
cd mobile && npm install && cd ..

# 4. Realtime
echo ""
echo "[4/5] Setting up realtime server..."
cd realtime && npm install && cd ..

# 5. ML
echo ""
echo "[5/5] Setting up ML workspace..."
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo ".env file created from .env.example — update values as needed."
fi

echo ""
echo "=== Setup complete! ==="
echo "Start backend:   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "Start mobile:    cd mobile && npm start"
echo "Start realtime:  cd realtime && npm run dev"
