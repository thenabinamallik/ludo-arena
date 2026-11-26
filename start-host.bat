@echo off
echo ======================================================
echo   LUDO ARENA - Local Companion Service Launcher
echo ======================================================
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

if not exist "apps\web\dist\index.html" (
  echo Building production bundle...
  call npm run build
)

echo Starting LUDO ARENA Companion Coordinator on port 3001...
start "" http://localhost:3001
call npm start
pause
