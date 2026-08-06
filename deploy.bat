@echo off
cd /d "%~dp0"

echo ============================================
echo  Feiyue Credit - Docker Deploy
echo ============================================

REM 1) Auto-create .env from template if missing (no blocking editor)
if not exist .env (
  if exist .env.example (
    copy /Y .env.example .env >nul
    echo [NOTE] Created .env from .env.example
    echo        WeChat login needs WX_APP_SECRET / JWT_SECRET - edit .env later if needed
  ) else (
    echo [WARN] .env.example not found - building without env file
  )
)

REM 2) Build and start frontend + backend
echo.
echo [1/2] Building and starting containers...
docker compose up -d --build
if errorlevel 1 (
  echo [ERROR] docker compose build failed - see output above.
  goto finish
)

REM 3) Wait for services to come up
echo [2/2] Waiting for services to come up...
timeout /t 8 >nul 2>&1 || ping -n 9 127.0.0.1 >nul

:finish
echo.
echo ============================================
echo  Running containers (docker ps):
echo ============================================
docker ps --format "table {{.Names}}    {{.Status}}    {{.Ports}}"
echo.
echo  Open in browser:  http://localhost:8080
echo  View logs:        docker compose logs -f
echo  Stop:             docker compose down
echo  Restart:          docker compose restart
echo ============================================
pause
