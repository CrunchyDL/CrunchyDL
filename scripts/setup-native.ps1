# CrunchyDL - Native Setup Script (Windows)
# This script automates the installation and build process without Docker.

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting CrunchyDL Setup (Windows)..." -ForegroundColor Cyan

# 1. Check Dependencies
function Check-Dependency($Name) {
    if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Error "❌ Error: $Name is not installed. Please install it and try again."
        exit 1
    }
}

Check-Dependency "node"
Check-Dependency "npm"
Check-Dependency "ffmpeg"
Check-Dependency "git"

Write-Host "✅ All system dependencies found." -ForegroundColor Green

# 2. Submodule Initialization
Write-Host "📦 Initializing submodules..." -ForegroundColor Yellow
git submodule update --init --recursive

# 3. Frontend Build
Write-Host "🎨 Building Frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build
Set-Location ..

# 4. Prepare Backend
Write-Host "⚙️ Preparing Backend..." -ForegroundColor Yellow
if (!(Test-Path backend\public)) { New-Item -ItemType Directory -Path backend\public }
Copy-Item -Path frontend\dist\* -Destination backend\public -Recurse -Force

Set-Location backend
npm install

# 5. Submodule Backend Setup
Write-Host "🏗️ Building multi-downloader-nx..." -ForegroundColor Yellow
Set-Location multi-downloader-nx
npm install --legacy-peer-deps
npm run tsc false false
Set-Location ..

Write-Host ""
Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host "--------------------------------------------------"
Write-Host "To start the server, run:"
Write-Host "cd backend; node index.js"
Write-Host "--------------------------------------------------"
Write-Host "Then visit http://localhost:3001 in your browser."
