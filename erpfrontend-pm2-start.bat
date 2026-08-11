@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ========================================
echo  HRMS Frontend - Build and PM2 Start
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not installed or not in PATH.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\pm2\bin\pm2" (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    echo.
    pause
    exit /b 1
  )
)

set "PM2=node node_modules\pm2\bin\pm2"

echo [1/2] Building production bundle...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. PM2 was not started.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting app with PM2 in the background...
echo.

%PM2% describe hrms-frontend >nul 2>&1
if errorlevel 1 (
  call %PM2% start ecosystem.config.cjs
) else (
  call %PM2% restart hrms-frontend --update-env
)

if errorlevel 1 (
  echo.
  echo [ERROR] PM2 failed to start the app.
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo  App is running in the background
echo  Name: hrms-frontend
echo  URL:  http://localhost:3000
echo ========================================
echo.
%PM2% status hrms-frontend
echo.
echo Useful commands:
echo   npm run pm2:logs
echo   npm run pm2:stop
echo   npm run pm2:restart
echo.
pause
