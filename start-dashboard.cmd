@echo off
setlocal

cd /d "%~dp0"

set "PORT=5177"
set "URL=http://127.0.0.1:%PORT%/"
set "NODE_EXE=C:\Users\JKN\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

echo Ministry Dashboard
echo Official local address: %URL%
echo.

if not exist "%NODE_EXE%" (
  echo Node runtime was not found at:
  echo %NODE_EXE%
  echo.
  echo Open this project in Codex again so the bundled runtime is available.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $client = [Net.Sockets.TcpClient]::new('127.0.0.1', %PORT%); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo Dashboard is already running. Opening %URL%
  start "" "%URL%"
  exit /b 0
)

echo Starting dashboard server on port %PORT%...
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process '%URL%'"
"%NODE_EXE%" "server.js"

echo.
echo Dashboard server stopped. Close this window or press any key.
pause >nul
