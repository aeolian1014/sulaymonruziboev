@echo off
REM Serves the portfolio on http://localhost:5178
REM Required: opening index.html directly with file:// blocks the ES module
REM that loads the 3D hero, so it silently falls back to a flat gradient.
cd /d "%~dp0"
start "" http://localhost:5178
python -m http.server 5178
