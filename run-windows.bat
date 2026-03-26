@echo off
TITLE CrunchyDL Server
echo 🔨 Running Setup Native...
powershell -ExecutionPolicy Bypass -File scripts\setup-native.ps1
echo "🚀 Starting CrunchyDL..."
cd /d backend
node index.js
