#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "======================================================"
echo "  LUDO ARENA - Local Companion Service Launcher"
echo "======================================================"

if [ ! -d "node_modules" ]; then
  npm install
fi

if [ ! -f "apps/web/dist/index.html" ]; then
  npm run build
fi

echo "Starting LUDO ARENA Companion Coordinator on http://localhost:3001"
npm start
