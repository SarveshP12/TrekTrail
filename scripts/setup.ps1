# TrekTrack AI: Full Development Setup (Windows)
$ErrorActionPreference = "Stop"

Write-Host "=== TrekTrack AI: Full Development Setup ===" -ForegroundColor Cyan

# 1. Start data services
Write-Host "`n[1/5] Starting Docker services (Postgres, TimescaleDB, Redis)..." -ForegroundColor Yellow
Push-Location infrastructure
docker compose up -d
Pop-Location

# 2. Backend
Write-Host "`n[2/5] Setting up backend..." -ForegroundColor Yellow
Push-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Pop-Location

# 3. Mobile
Write-Host "`n[3/5] Setting up mobile app..." -ForegroundColor Yellow
Push-Location mobile
npm install
Pop-Location

# 4. Realtime
Write-Host "`n[4/5] Setting up realtime server..." -ForegroundColor Yellow
Push-Location realtime
npm install
Pop-Location

# 5. ML
Write-Host "`n[5/5] Setting up ML workspace..." -ForegroundColor Yellow
Push-Location ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Pop-Location

# Copy env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "`n.env file created from .env.example - update values as needed." -ForegroundColor Green
}

Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Start backend:   cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload"
Write-Host "Start mobile:    cd mobile; npm start"
Write-Host "Start realtime:  cd realtime; npm run dev"
