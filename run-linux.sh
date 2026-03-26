#!/bin/bash
echo "🔨 Running Setup Native..."
bash scripts/setup-native.sh
echo "🚀 Starting CrunchyDL..."
cd backend
node index.js
