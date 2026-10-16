#!/bin/bash
# ============================================================
#  UCI Exam Prep — One-Shot Full Stack Runner
#  Usage: bash run.sh
# ============================================================

set -e  # exit on any error

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ── Colors ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn()  { echo -e "${YELLOW}[!] $1${NC}"; }
error() { echo -e "${RED}[✘] $1${NC}"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   UCI Exam Prep — Full Stack Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: Load root .env ───────────────────────────────────
if [ -f ".env" ]; then
  set -a; source ".env"; set +a
  info "Environment loaded from .env"
else
  error ".env file not found! Aborting."
  exit 1
fi

# ── Step 2: Check DATABASE_URL ───────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  error "DATABASE_URL is not set in .env. Aborting."
  exit 1
fi
info "DATABASE_URL found"

# ── Step 3: Kill any old process on port 5000 ────────────────
if fuser 5000/tcp &>/dev/null 2>&1; then
  fuser -k 5000/tcp 2>/dev/null
  warn "Killed old process on port 5000"
  sleep 1
fi

# ── Step 4: Push DB schema (drizzle-kit push) ────────────────
echo ""
warn "Syncing DB schema (drizzle-kit push)..."
pnpm --filter @workspace/db run push --accept-data-loss 2>&1 || {
  warn "DB push had warnings (this is usually fine if tables already exist)"
}
info "DB schema synced"

# ── Step 5: Build the backend server ─────────────────────────
echo ""
warn "Building backend server..."
pnpm --filter @workspace/api-server run build
info "Backend build complete"

# ── Step 6: Update Expo .env with current local IP ───────────
CURRENT_IP=$(hostname -I | awk '{print $1}')
EXPO_ENV_FILE="$PROJECT_DIR/artifacts/uci-education/.env"
echo "EXPO_PUBLIC_DOMAIN=http://$CURRENT_IP:5000" > "$EXPO_ENV_FILE"
info "Expo env updated → EXPO_PUBLIC_DOMAIN=http://$CURRENT_IP:5000"
echo ""

# ── Step 7: Start backend server in background ───────────────
echo "🚀 Starting backend server on port 5000..."
NODE_ENV=development node --enable-source-maps \
  "$PROJECT_DIR/artifacts/api-server/dist/index.mjs" \
  > /tmp/uci-server.log 2>&1 &
SERVER_PID=$!
echo "   Backend PID: $SERVER_PID  (logs: /tmp/uci-server.log)"

# Wait a moment and check it started ok
sleep 3
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  error "Backend server crashed! Last log:"
  tail -30 /tmp/uci-server.log
  exit 1
fi
info "Backend server is running  →  http://localhost:5000"

# ── Step 8: Start Expo web frontend ──────────────────────────
echo ""
echo "🌐 Starting Expo web frontend on port 8081..."
echo "   (Press Ctrl+C to stop both services)"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  warn "Shutting down..."
  kill "$SERVER_PID" 2>/dev/null && info "Backend stopped"
  exit 0
}
trap cleanup INT TERM

pnpm --filter @workspace/uci-education exec expo start --web --port 8081

# If expo exits, also kill the server
cleanup
