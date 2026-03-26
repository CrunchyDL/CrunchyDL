#!/bin/bash
echo "Building CrunchyDL System Tray Launcher..."
cd launcher
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Compiling binaries..."
npm run build:linux
npm run build:win
echo ""
echo "Binaries are available in launcher/bin/"
