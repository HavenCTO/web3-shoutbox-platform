#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

LOG=/tmp/shoutbox-bot.log

# Kill any existing bot
pkill -f "tsx src/main.ts" 2>/dev/null || true
sleep 1

echo "[start-bot] Starting shoutbox-bot in background, logging to $LOG"
nohup npm start > "$LOG" 2>&1 &
BOT_PID=$!
echo "[start-bot] Bot PID: $BOT_PID"

# Wait a moment for startup, then show initial log
sleep 12
echo "=== Initial log output ==="
cat "$LOG"
