#!/bin/bash
# UCI Exam Prep - Backend Server Starter
# Run this script before starting the Expo app

# ── Root directory resolve karo (script jahan bhi se run ho) ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UCI Backend Server Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get current IP
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo "📡 Your IP: $CURRENT_IP"
echo "🔌 API URL: http://$CURRENT_IP:5000"

# Update Expo .env with current IP
EXPO_ENV="$SCRIPT_DIR/artifacts/uci-education/.env"
echo "EXPO_PUBLIC_DOMAIN=http://$CURRENT_IP:5000" > "$EXPO_ENV"
echo "✅ Updated $EXPO_ENV"

# Root .env file
ROOT_ENV="$SCRIPT_DIR/.env"
if [ ! -f "$ROOT_ENV" ]; then
  echo "❌ Root .env not found at: $ROOT_ENV"
  exit 1
fi

# Kill any existing server on port 5000
fuser -k 5000/tcp 2>/dev/null && echo "♻️  Killed old server on port 5000"

# Load root .env variables
set -a
source "$ROOT_ENV"
set +a

echo "🚀 Starting server (PORT=5000)..."
cd "$SCRIPT_DIR/artifacts/api-server"
NODE_ENV=development node --enable-source-maps ./dist/index.mjs
