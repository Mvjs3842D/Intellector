@echo off
title Stopping Intellector
color 0C

echo.
echo  ============================================
echo     STOPPING INTELLECTOR
echo  ============================================
echo.

echo [1/3] Stopping Backend (port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>nul
    echo       Killed PID %%a
)

echo [2/3] Stopping Frontend (port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>nul
    echo       Killed PID %%a
)

echo [3/3] Closing Intellector windows...
taskkill /FI "WINDOWTITLE eq Intellector-Backend" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Intellector-Frontend" /F >nul 2>nul

echo.
echo  ============================================
echo     ALL SERVICES STOPPED
echo  ============================================
echo.
pause