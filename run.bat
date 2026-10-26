@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Smart City Route Navigation - Backend
echo ========================================

echo.
echo Installing required Python packages...
py -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Could not install Python packages. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo Starting Smart City server...
py app.py
pause
