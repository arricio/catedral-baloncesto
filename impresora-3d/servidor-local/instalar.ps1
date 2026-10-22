<#
  IMPRESORA 3D · Instalador del servidor local para Windows 11 + NVIDIA
  ---------------------------------------------------------------------
  1. Comprueba la tarjeta gráfica NVIDIA y su memoria (VRAM).
  2. Activa WSL2 e instala Ubuntu 22.04 (puede pedir reiniciar; después vuelve a ejecutarlo).
  3. Pide la contraseña que usarán tus amigos.
  4. Dentro de Ubuntu instala: CUDA, Miniconda, TRELLIS (o TRELLIS.2), FLUX/SDXL-Turbo y cloudflared.
  5. Crea en el escritorio el acceso «IMPRESORA 3D - Servidor».
  Todo es gratuito y de código abierto.
#>
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Titulo($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  [!] $t" -ForegroundColor Yellow }
function Fallo($t) { Write-Host "  [X] $t" -ForegroundColor Red; Read-Host 'Pulsa Enter para salir'; exit 1 }

# ── Permisos de administrador ──
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

Write-Host "`n  IMPRESORA 3D · Servidor local gratuito (Modo B)`n" -ForegroundColor Magenta

# ── 1. Tarjeta gráfica ──
Titulo 'Comprobando la tarjeta gráfica NVIDIA'
$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if (-not $smi) { Fallo 'No encuentro nvidia-smi. Instala el controlador más reciente de NVIDIA (https://www.nvidia.com/drivers) y vuelve a ejecutar.' }
$gpuInfo = (& nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits | Select-Object -First 1).Split(',')
$gpuNombre = $gpuInfo[0].Trim()
$vramGB = [math]::Round([int]$gpuInfo[1].Trim() / 1024, 1)
Ok "$gpuNombre con $vramGB GB de VRAM"
if ($vramGB -lt 15) { Fallo "Hacen falta al menos 16 GB de VRAM para TRELLIS. Con $vramGB GB usa el Modo A (nube gratuita)." }
if ($gpuNombre -match 'RTX 50') { Aviso 'Las RTX 50xx (Blackwell) todavía no están verificadas con TRELLIS; puede requerir ajustes manuales (ver README).' }

$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
Ok "Memoria RAM: $ramGB GB"

# Modelos según la memoria disponible
$modelo3D = if ($vramGB -ge 23) { 'trellis2' } else { 'trellis' }
$textoImagen = if ($vramGB -ge 23 -or $ramGB -ge 32) { 'flux-schnell' } else { 'sdxl-turbo' }
Ok "Imagen→3D: $modelo3D · Texto→imagen: $textoImagen"

# ── 2. WSL2 + Ubuntu ──
Titulo 'Preparando WSL2 (Linux dentro de Windows)'
$distros = (wsl.exe -l -q 2>$null) -replace "`0", ''
if (-not ($distros -match 'Ubuntu-22.04')) {
  Aviso 'Instalando WSL2 y Ubuntu 22.04. Si Windows pide reiniciar, reinicia y vuelve a ejecutar INSTALAR.bat.'
  wsl.exe --install -d Ubuntu-22.04 --no-launch
  if ($LASTEXITCODE -ne 0) { Fallo 'No se pudo instalar WSL. Activa la virtualización en la BIOS y vuelve a intentarlo.' }
  wsl.exe -d Ubuntu-22.04 -u root -- echo 'Ubuntu listo' 2>$null
  if ($LASTEXITCODE -ne 0) {
    Aviso 'Reinicia el ordenador y ejecuta de nuevo INSTALAR.bat para continuar.'
    Read-Host 'Pulsa Enter para salir'; exit 0
  }
}
wsl.exe --set-default-version 2 | Out-Null
Ok 'Ubuntu 22.04 en WSL2'

# Más memoria para WSL (por defecto solo usa la mitad de la RAM)
$wslconfig = Join-Path $env:USERPROFILE '.wslconfig'
if (-not (Test-Path $wslconfig)) {
  $memWSL = [math]::Max(8, [math]::Floor($ramGB * 0.75))
  "[wsl2]`r`nmemory=${memWSL}GB`r`nswap=16GB`r`n" | Set-Content -Path $wslconfig -Encoding ascii
  wsl.exe --shutdown
  Ok "WSL podrá usar $memWSL GB de RAM"
}

# ── 3. Contraseña ──
Titulo 'Contraseña para tus amigos'
Write-Host '  Elige una contraseña (mínimo 8 caracteres). Se la darás a quien quieras que use tu servidor.'
do { $clave = Read-Host '  Contraseña' } while ($clave.Length -lt 8)

$urlApp = Read-Host '  Dirección de tu app (Enter = https://arricio.github.io/impresora-3d/)'
if (-not $urlApp) { $urlApp = 'https://arricio.github.io/impresora-3d/' }

$config = @{ clave = $clave; modelo_3d = $modelo3D; texto_imagen = $textoImagen; url_app = $urlApp; puerto = 8188; descargar_a_cpu = $true } | ConvertTo-Json
$aqui = Split-Path -Parent $PSCommandPath
# UTF-8 sin BOM (Python no lo acepta en JSON)
[IO.File]::WriteAllText((Join-Path $aqui 'config.json'), $config, (New-Object System.Text.UTF8Encoding $false))

# ── 4. Instalación dentro de Ubuntu ──
Titulo 'Instalando la IA dentro de Ubuntu (30-90 minutos, descarga ~25 GB)'
$rutaWSL = (wsl.exe -d Ubuntu-22.04 -u root -- wslpath -a "$aqui").Trim()
wsl.exe -d Ubuntu-22.04 -u root -- bash "$rutaWSL/instalar.sh" "$rutaWSL" $modelo3D
if ($LASTEXITCODE -ne 0) { Fallo 'La instalación en Ubuntu falló. Revisa los mensajes de arriba (y el README, sección Problemas).' }

# ── 5. Acceso directo ──
Titulo 'Creando el acceso directo en el escritorio'
$escritorio = [Environment]::GetFolderPath('Desktop')
Copy-Item (Join-Path $aqui 'INICIAR-SERVIDOR.bat') (Join-Path $escritorio 'IMPRESORA 3D - Servidor.bat') -Force
Ok 'Acceso directo «IMPRESORA 3D - Servidor» creado'

Write-Host "`n¡Todo listo! 🎉  Haz doble clic en «IMPRESORA 3D - Servidor» del escritorio para encenderlo." -ForegroundColor Green
Write-Host 'La primera vez descargará los modelos (unos minutos más).'
Read-Host 'Pulsa Enter para salir'
