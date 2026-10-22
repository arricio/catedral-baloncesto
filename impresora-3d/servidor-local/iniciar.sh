#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  IMPRESORA 3D · Enciende el servidor y lo publica con Cloudflare Tunnel.
#  Muestra el ENLACE DE INVITACIÓN (y un código QR) para tus amigos.
# ═══════════════════════════════════════════════════════════════
set -uo pipefail
BASE=/opt/impresora3d
DIR="$BASE/servidor"
source "$BASE/conda/etc/profile.d/conda.sh"
source "$DIR/entorno.sh"
conda activate "$IMPRESORA_ENTORNO"
export PYTHONPATH="$IMPRESORA_REPO:${PYTHONPATH:-}"
export IMPRESORA_DATOS="$BASE/datos"
cd "$DIR"

PUERTO=$(python -c "import json;print(json.load(open('config.json')).get('puerto',8188))")
URL_APP=$(python -c "import json;print(json.load(open('config.json')).get('url_app','https://arricio.github.io/impresora-3d/'))")
CLAVE=$(python -c "import json;print(json.load(open('config.json'))['clave'])")
TOKEN_TUNEL=$(python -c "import json;print(json.load(open('config.json')).get('tunel_token',''))")
URL_FIJA=$(python -c "import json;print(json.load(open('config.json')).get('tunel_url',''))")

limpiar() { echo -e "\nApagando…"; kill "${PID_SRV:-}" "${PID_TUN:-}" 2>/dev/null; exit 0; }
trap limpiar INT TERM

echo "🖨️  Encendiendo IMPRESORA 3D…"
python servidor.py &
PID_SRV=$!
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$PUERTO/api/estado" >/dev/null && break; sleep 1; done

REGISTRO=$(mktemp)
if [ -n "$TOKEN_TUNEL" ]; then
  # Túnel con nombre (dirección fija; necesita un dominio propio en Cloudflare).
  cloudflared tunnel --no-autoupdate run --token "$TOKEN_TUNEL" >"$REGISTRO" 2>&1 &
  PID_TUN=$!
  URL="$URL_FIJA"
else
  # Túnel rápido gratuito: sin cuenta, pero la dirección cambia cada vez que se enciende.
  cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PUERTO" >"$REGISTRO" 2>&1 &
  PID_TUN=$!
  URL=""
  for _ in $(seq 1 45); do
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$REGISTRO" | head -1)
    [ -n "$URL" ] && break
    sleep 1
  done
fi

if [ -z "$URL" ]; then
  echo "❌ No se pudo abrir el túnel de Cloudflare. ¿Hay internet? Detalles:"; tail -20 "$REGISTRO"
else
  ENLACE="${URL_APP%/}/#/conectar?url=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$URL")&clave=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$CLAVE")"
  echo
  echo "════════════════════════════════════════════════════════════"
  echo " ✅ Servidor encendido y publicado"
  echo "    Dirección:  $URL"
  echo "    Contraseña: $CLAVE"
  echo
  echo " 📲 ENLACE DE INVITACIÓN (envíalo por WhatsApp a tus amigos):"
  echo "    $ENLACE"
  echo "════════════════════════════════════════════════════════════"
  qrencode -t ANSIUTF8 "$ENLACE" 2>/dev/null || true
  echo " Escanea el QR con el móvil para conectarte. Deja esta ventana abierta."
fi
wait "$PID_SRV"
