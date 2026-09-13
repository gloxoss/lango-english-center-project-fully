@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\deploy-to-vps.ps1" %*
if %ERRORLEVEL% neq 0 (
    echo.
    echo Deployment exited with error code %ERRORLEVEL%.
    pause
)
