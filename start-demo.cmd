@echo off
rem Starts the API and the web app in two windows. First run creates the database and demo data.
cd /d "%~dp0"
start "StageTrack API" cmd /k "cd backend\src\StageTrack.HttpApi.Host && dotnet run --launch-profile http"
if not exist frontend\node_modules (
  pushd frontend
  call npm install
  popd
)
start "StageTrack Web" cmd /k "cd frontend && npm run dev"
timeout /t 12 >nul
start "" http://localhost:5180
