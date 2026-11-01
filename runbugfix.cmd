@echo off
setlocal
cd /d "%~dp0"
for /f "delims=" %%f in ('dir /b /o-d "bugfixes\BUG-*.html" 2^>nul') do (
  start "" "%~dp0bugfixes\%%f"
  exit /b 0
)
echo No bug reports found.
pause
