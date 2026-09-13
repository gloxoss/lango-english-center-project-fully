@echo off
setlocal
cd /d "%~dp0lango-app"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0lango-app\scripts\deploy-to-vps.ps1" %*
if %ERRORLEVEL% neq 0 (
    echo.
    echo Deployment exited with error code %ERRORLEVEL%.
    pause
)
