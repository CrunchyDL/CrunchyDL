#!/bin/bash

# CrunchyDL - Native Setup Script (Linux)
# This script automates the installation and build process without Docker.

set -e

echo "🚀 Starting CrunchyDL Setup (Linux)..."

# 1. Check Dependencies
check_dep() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ Error: $1 is not installed. Please install it and try again."
        exit 1
    fi
}

check_dep "node"
check_dep "npm"
check_dep "ffmpeg"
check_dep "git"

echo "✅ All system dependencies found."

# 2. Submodule Initialization
echo "📦 Initializing submodules..."
git submodule update --init --recursive

# 3. Frontend Build
echo "🎨 Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# 4. Prepare Backend
echo "⚙️ Preparing Backend..."
mkdir -p backend/public
cp -r frontend/dist/* backend/public/

cd backend
npm install

# 5. Submodule Backend Setup
echo "🏗️ Building multi-downloader-nx..."
cd multi-downloader-nx
npm install --legacy-peer-deps
npm run tsc false false
cd ..

echo ""
echo "✨ Setup Complete!"
echo "--------------------------------------------------"
echo "To start the server, run:"
echo "cd backend && node index.js"
echo "--------------------------------------------------"
echo "Then visit http://localhost:3001 in your browser."
