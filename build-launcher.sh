#!/bin/bash
echo "Building CrunchyDL System Tray Launcher..."
cd launcher
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Compiling binaries..."
npm run build:linux
echo ""
echo "Copying launcher to project root..."
cp dist/*.AppImage ../CrunchyDL-Launcher.AppImage
echo "Binaries are available in project root: CrunchyDL-Launcher.AppImage"
