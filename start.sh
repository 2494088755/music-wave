#!/bin/bash
cd "$(dirname "$0")/backend"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🚀 Starting MusicWave server..."
node server.js
