@echo off
echo Building CrunchyDL System Tray Launcher...
cd launcher
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo Compiling binaries...
call npm run build:win
echo.
echo Copying launcher to project root...
copy "dist\CrunchyDL Launcher 1.0.0.exe" "..\CrunchyDL-Launcher.exe" /Y
echo.
echo Binaries are available in project root: CrunchyDL-Launcher.exe
pause
