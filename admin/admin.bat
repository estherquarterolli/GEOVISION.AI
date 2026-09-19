@echo off
chcp 65001 > nul
cd /d "%~dp0.."

if exist "ai-service\.venv\Scripts\python.exe" (
    "ai-service\.venv\Scripts\python.exe" admin\menu.py
) else if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" admin\menu.py
) else (
    python admin\menu.py
)

pause

