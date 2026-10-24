@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
    py -3 "%~dp0app.py" %*
    if errorlevel 1 pause
    exit /b
)
where python >nul 2>&1
if not errorlevel 1 (
    python "%~dp0app.py" %*
    if errorlevel 1 pause
    exit /b
)
echo Python 3.10 or newer is required to run Port Scout.
echo Install it from https://www.python.org/downloads/ and run this file again.
echo On Windows, you can enable "Add Python to PATH" during installation.
pause
exit /b 1
