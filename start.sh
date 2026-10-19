#!/usr/bin/env bash
# Restart the production server + public Cloudflare tunnel. Usage: ./start.sh [--rebuild]
cd "$(dirname "$0")"
mkdir -p logs
[ "$1" = "--rebuild" ] && npm run build
# stop old ones
[ -f logs/server.pid ] && kill "$(cat logs/server.pid)" 2>/dev/null
[ -f logs/tunnel.pid ] && kill "$(cat logs/tunnel.pid)" 2>/dev/null
pkill -f "vite preview --host 0.0.0.0 --port 4173" 2>/dev/null
pkill -f "cloudflared tunnel --url http://localhost:4173" 2>/dev/null
sleep 1
nohup ./node_modules/.bin/vite preview --host 0.0.0.0 --port 4173 --strictPort > logs/server.log 2>&1 &
echo $! > logs/server.pid
nohup cloudflared tunnel --no-autoupdate --protocol http2 --url http://localhost:4173 > logs/tunnel.log 2>&1 &
echo $! > logs/tunnel.pid
for i in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' logs/tunnel.log | head -1)
  [ -n "$URL" ] && break; sleep 1
done
echo "$URL" > logs/public-url.txt
echo "Server PID: $(cat logs/server.pid)  Tunnel PID: $(cat logs/tunnel.pid)"
echo "Local:  http://localhost:4173/"
echo "Public: ${URL:-'(not ready yet — check logs/tunnel.log)'}"
