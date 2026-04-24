#!/usr/bin/env bash
# Teklif servisini ve cloudflared tunnel'ını birlikte başlatır (WSL içinde).
# Kullanım: bash deploy/start.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
LOG_DIR="${LOG_DIR:-$HOME/.local/log/teklify}"
mkdir -p "$LOG_DIR"

# 1) MongoDB çalışıyor mu kontrol et
if ! pgrep -x mongod >/dev/null; then
  echo "[start] mongod çalışmıyor — başlatmayı deniyorum..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start mongod || true
  fi
  if ! pgrep -x mongod >/dev/null; then
    echo "[start] HATA: mongod başlatılamadı. Manuel başlatın: 'sudo mongod --fork --logpath /var/log/mongod.log'" >&2
    exit 1
  fi
fi
echo "[start] mongod ✓"

# 2) Server (Node) — arka planda
cd "$SERVER_DIR"
if [ ! -d node_modules ]; then
  echo "[start] node_modules yok, npm install çalıştırılıyor..."
  npm install
fi
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "[start] Playwright Chromium kurulumu..."
  npx playwright install --with-deps chromium
fi

NODE_LOG="$LOG_DIR/server.log"
echo "[start] node başlatılıyor → $NODE_LOG"
nohup npm run dev >"$NODE_LOG" 2>&1 &
NODE_PID=$!
echo "[start] node pid=$NODE_PID"

# 3) Cloudflared tunnel — ön planda (Ctrl+C ile durdurulur)
trap "echo '[start] kapanıyor'; kill $NODE_PID 2>/dev/null || true; exit 0" INT TERM

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[start] cloudflared kurulu değil. https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/install-and-setup/installation/" >&2
  echo "[start] Server tek başına çalışıyor. Tunnel kurduktan sonra: cloudflared tunnel run teklify"
  wait $NODE_PID
fi

CFG="${CFG:-$HOME/.cloudflared/config.yml}"
if [ ! -f "$CFG" ]; then
  echo "[start] $CFG yok — deploy/cloudflared-config.yml.example dosyasını kopyalayın." >&2
  echo "[start] Server tek başına çalışıyor. Cloudflared elle başlatılana kadar public preview erişilemez."
  wait $NODE_PID
fi

echo "[start] cloudflared tunnel başlatılıyor..."
cloudflared tunnel --config "$CFG" run
