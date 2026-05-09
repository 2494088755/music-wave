@echo off
cd /d "%~dp0backend"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)
echo Starting MusicWave server...
node server.js
pause
