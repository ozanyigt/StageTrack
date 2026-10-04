@echo off
rem Drops the local demo database. Stop the API first; the next API start recreates it with fresh demo data.
cd /d "%~dp0backend"
dotnet ef database drop -f -p src\StageTrack.EntityFrameworkCore -s src\StageTrack.HttpApi.Host
echo.
echo Database dropped. Start the API again (start-demo.cmd) to reseed.
pause
