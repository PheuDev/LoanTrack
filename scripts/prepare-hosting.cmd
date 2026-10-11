@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-hosting.ps1"
if errorlevel 1 (
  echo.
  echo La preparation a echoue. Aucun secret ne sera affiche.
)
echo.
pause
