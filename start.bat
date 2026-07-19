@echo off
title Feiyue Credit System (local)
where node >nul 2>nul
if %errorlevel%==0 (
  set NODE=node
  set NPM=npm
) else (
  set NODE=C:\Users\40814\.workbuddy\binaries\node\versions\22.22.2\node.exe
  set NPM=C:\Users\40814\.workbuddy\binaries\node\versions\22.22.2\node_modules\npm\bin\npm-cli.js
)
set PORT=3001
cd /d "%~dp0server"
if not exist node_modules (
  echo Installing dependencies, please wait...
  "%NODE%" "%NPM%" install
)
echo.
echo  ============================================
echo   Feiyue Class 10 Credit System is starting
echo   Open: http://localhost:3001
echo   Login: admin / 123456
echo   Close this window to stop the server.
echo  ============================================
echo.
start "" http://localhost:3001
"%NODE%" src/index.js
