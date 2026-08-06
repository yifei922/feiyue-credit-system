@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
set "NODE_OPTIONS="
cd /d "%~dp0"

echo ============================================================
echo   Feiyue Credit System - Pure Node.js Local Deploy
echo ============================================================
echo.

set "NODE_DIR="

:: --- Try 24.14.0 ---
if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\24.14.0\node.exe" (
  if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\24.14.0\npm.cmd" (
    set "NODE_DIR=%USERPROFILE%\.workbuddy\binaries\node\versions\24.14.0\"
  )
)

:: --- Try 22.22.2 ---
if not defined NODE_DIR (
  if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe" (
    if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\npm.cmd" (
      set "NODE_DIR=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\"
    )
  )
)

:: --- Result ---
if not defined NODE_DIR (
  echo.
  echo   ERROR: Node.js + npm.cmd not found together.
  echo   Checked: 24.14.0, 22.22.2 under .workbuddy\binaries\node\versions\
  pause
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
echo [1/5] Node %NODE_DIR%node.exe
for /f "tokens=*" %%v in ('"%NODE_DIR%node.exe" -v 2^>nul') do echo       %%v
echo       npm  %NODE_DIR%npm.cmd
echo.

echo [2/5] .env ...
if not exist server\.env (
  if exist .env.example copy .env.example server\.env >nul
)
echo       done
echo.

echo [3/5] npm install ...
cd server
call "%NODE_DIR%npm.cmd" install --cache ..\.npmcache 2>&1
if errorlevel 1 ( cd .. & pause & exit /b 1 )
cd ..\frontend
call "%NODE_DIR%npm.cmd" install --cache ..\.npmcache 2>&1
if errorlevel 1 ( cd .. & pause & exit /b 1 )
cd ..
echo       done
echo.

echo [4/5] Build frontend ...
cd frontend
call "%NODE_DIR%npm.cmd" run build 2>&1
if errorlevel 1 ( cd .. & pause & exit /b 1 )
cd ..
echo       done
echo.

echo [5/5] Starting server on port 3001 ...
cd server
"%NODE_DIR%node.exe" -e "require('./db').init()" 2>nul
echo.
echo   ========================================
echo     http://localhost:3001  (Ctrl+C to stop)
echo   ========================================
echo.
"%NODE_DIR%node.exe" src/index.js
echo.
pause
