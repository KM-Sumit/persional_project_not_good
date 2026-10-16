#!/bin/bash
# UCI Exam Prep - Backend Server Starter
# Run this script before starting the Expo app

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UCI Backend Server Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get current IP
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo "📡 Your IP: $CURRENT_IP"
echo "🔌 API URL: http://$CURRENT_IP:5000"

# Update .env in expo app with current IP
ENV_FILE="$(dirname "$0")/artifacts/uci-education/.env"
echo "EXPO_PUBLIC_DOMAIN=http://$CURRENT_IP:5000" > "$ENV_FILE"
echo "✅ Updated $ENV_FILE"

# Kill any existing server on port 5000
fuser -k 5000/tcp 2>/dev/null && echo "♻️  Killed old server on port 5000"

# Load root .env and start server
cd "$(dirname "$0")/artifacts/api-server"
set -a
source "$(dirname "$0")/.env"
set +a

echo "🚀 Starting server..."
NODE_ENV=development node --enable-source-maps ./dist/index.mjs
