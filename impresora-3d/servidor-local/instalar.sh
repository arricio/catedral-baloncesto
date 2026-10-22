#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  IMPRESORA 3D · Instalación dentro de Ubuntu (WSL2). Lo lanza instalar.ps1.
#  Uso: bash instalar.sh <carpeta-servidor-local> <trellis|trellis2>
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
ORIGEN="${1:?falta la carpeta}"
MODELO="${2:-trellis}"
BASE=/opt/impresora3d
CONDA="$BASE/conda"
export DEBIAN_FRONTEND=noninteractive

paso() { echo -e "\n\033[1;36m▶ $*\033[0m"; }

paso "Paquetes del sistema"
apt-get update -y
apt-get install -y build-essential git wget curl ca-certificates qrencode libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 ninja-build

paso "Kit de CUDA (para compilar las extensiones de TRELLIS)"
if [ "$MODELO" = "trellis2" ]; then CUDA_VER=12-4; CUDA_DIR=/usr/local/cuda-12.4; else CUDA_VER=11-8; CUDA_DIR=/usr/local/cuda-11.8; fi
if [ ! -d "$CUDA_DIR" ]; then
  wget -q https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.1-1_all.deb -O /tmp/cuda-keyring.deb
  dpkg -i /tmp/cuda-keyring.deb
  apt-get update -y
  apt-get install -y "cuda-toolkit-$CUDA_VER"
fi
export CUDA_HOME="$CUDA_DIR" PATH="$CUDA_DIR/bin:$PATH" LD_LIBRARY_PATH="$CUDA_DIR/lib64:${LD_LIBRARY_PATH:-}"

paso "Cloudflare Tunnel (cloudflared)"
if ! command -v cloudflared >/dev/null; then
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -O /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
fi

paso "Miniconda"
mkdir -p "$BASE"
if [ ! -x "$CONDA/bin/conda" ]; then
  wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
  bash /tmp/miniconda.sh -b -p "$CONDA"
fi
source "$CONDA/etc/profile.d/conda.sh"
conda config --set always_yes yes
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main >/dev/null 2>&1 || true
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r >/dev/null 2>&1 || true

if [ "$MODELO" = "trellis2" ]; then
  paso "TRELLIS.2 (Microsoft, licencia MIT)"
  [ -d "$BASE/TRELLIS.2" ] || git clone --recursive https://github.com/microsoft/TRELLIS.2.git "$BASE/TRELLIS.2"
  cd "$BASE/TRELLIS.2"
  if ! conda env list | grep -q "^trellis2 "; then
    # El script oficial no está pensado para «set -eu»: lo relajamos mientras se ejecuta.
    set +eu
    # shellcheck disable=SC1091
    . ./setup.sh --new-env --basic --flash-attn --nvdiffrast --nvdiffrec --cumesh --o-voxel --flexgemm
    set -eu
  fi
  ENTORNO=trellis2
else
  paso "TRELLIS (Microsoft, licencia MIT)"
  [ -d "$BASE/TRELLIS" ] || git clone --recursive https://github.com/microsoft/TRELLIS.git "$BASE/TRELLIS"
  cd "$BASE/TRELLIS"
  if ! conda env list | grep -q "^trellis "; then
    set +eu
    # shellcheck disable=SC1091
    . ./setup.sh --new-env --basic --xformers --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast
    set -eu
  fi
  ENTORNO=trellis
fi
set +u
conda activate "$ENTORNO"
set -u

paso "Servidor web, texto→imagen y notificaciones"
pip install --upgrade "fastapi>=0.110" "uvicorn[standard]" python-multipart pywebpush py-vapid \
  "diffusers>=0.32" "transformers>=4.44" accelerate sentencepiece protobuf rembg onnxruntime-gpu

paso "Copiando el servidor"
mkdir -p "$BASE/servidor"
cp "$ORIGEN/servidor.py" "$ORIGEN/iniciar.sh" "$BASE/servidor/"
cp "$ORIGEN/config.json" "$BASE/servidor/config.json"
chmod 600 "$BASE/servidor/config.json"
cat > "$BASE/servidor/entorno.sh" <<ENV
export CUDA_HOME=$CUDA_DIR
export PATH=$CUDA_DIR/bin:\$PATH
export LD_LIBRARY_PATH=$CUDA_DIR/lib64:\${LD_LIBRARY_PATH:-}
export IMPRESORA_ENTORNO=$ENTORNO
export IMPRESORA_REPO=$BASE/$( [ "$MODELO" = trellis2 ] && echo TRELLIS.2 || echo TRELLIS )
ENV

paso "Comprobando la GPU desde Ubuntu"
python -c "import torch; print('PyTorch', torch.__version__, '· CUDA disponible:', torch.cuda.is_available(), '·', torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"

echo -e "\n\033[1;32m✔ Instalación terminada.\033[0m"
