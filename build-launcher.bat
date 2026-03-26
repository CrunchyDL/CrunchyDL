@echo off
echo Building CrunchyDL System Tray Launcher...
cd launcher
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo Compiling binaries...
call npm run build:win
call npm run build:linux
echo.
echo Binaries are available in launcher/bin/
pause
