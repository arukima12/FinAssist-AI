@echo off
echo ===================================================
echo Starting FinAssist AI Local Backend (FastAPI + Chroma)
echo ===================================================
cd backend
call venv\Scripts\activate.bat
python main.py
pause
