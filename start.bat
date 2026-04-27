@echo off
title Intellector - AI Teaching Assistant
color 0A

echo.
echo  ============================================
echo     INTELLECTOR - AI Teaching Assistant
echo  ============================================
echo.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found!
    echo Install from https://python.org
    pause
    exit /b
)

:: Setup on first run
if not exist "backend\venv" (
    echo [SETUP] First time setup...
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install flask flask-cors requests
    deactivate
    cd ..
    echo [SETUP] Done!
    echo.
)

:: Start Ollama
echo [1/3] Starting Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>nul | findstr "ollama.exe" >nul 2>nul
if %errorlevel% neq 0 (
    start /B /MIN cmd /c "ollama serve" 2>nul
    timeout /t 3 /nobreak >nul
)
echo       Ollama: http://localhost:11434

:: Start Backend
echo [2/3] Starting Backend...
start /MIN cmd /k "title Intellector-Backend && cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python app.py"
timeout /t 4 /nobreak >nul
echo       Backend: http://localhost:5000

:: Start Frontend
echo [3/3] Starting Frontend...
start /MIN cmd /k "title Intellector-Frontend && cd /d "%~dp0frontend" && python -m http.server 3000"
timeout /t 2 /nobreak >nul
echo       Frontend: http://localhost:3000

echo.
echo  ============================================
echo       ALL SYSTEMS RUNNING!
echo  ============================================
echo.
echo   Opening browser...
echo.

:: Open browser
start http://localhost:3000

echo   To stop: close all Intellector windows
echo   or run stop.bat
echo.
echo  ============================================
echo   Press any key to exit this launcher...
echo  ============================================
pause >nul