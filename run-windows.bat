@echo off
TITLE CrunchyDL Server
echo 🔨 Running Setup Native...
powershell -ExecutionPolicy Bypass -File scripts\setup-native.ps1
echo "🚀 Starting CrunchyDL..."
cd backend
node index.js
pause
