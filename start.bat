@echo off
title Feiyue Credit System (local)
cd /d "%~dp0"
set PORT=3001

REM 优先用系统已装的 node；没有则用压缩包自带的 runtime\node.exe（便携，无需安装）
where node >nul 2>nul
if %errorlevel%==0 (
  set NODE=node
) else (
  if exist "%~dp0runtime\node.exe" (
    set NODE=%~dp0runtime\node.exe
  ) else (
    echo [错误] 未找到 Node.js。请确认 runtime 文件夹已随压缩包一起解压，
    echo        或到 https://nodejs.org 安装 Node.js (LTS) 后重试。
    pause
    exit /b 1
  )
)

cd /d "%~dp0server"
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
