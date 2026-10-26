# EL MEJOR MÉDICO (Unreal): ciclo de trabajo en el portátil.
#   -Compilar     compila el C++ del editor
#   -Tarea x.py   ejecuta Herramientas/x.py dentro del editor (se cierra solo)
#   -Probar       abre el juego (1600×900) con la prueba automática: fotos en Saved/Capturas y conversación en Saved/Prueba.txt
#   -Empaquetar   empaqueta la versión de Windows en Empaquetado/Windows (sombreadores ya compilados)
#   -ProbarPaquete  la prueba automática con el juego empaquetado (lo que recibirá el usuario)
param([switch]$Compilar, [string]$Tarea, [switch]$Probar, [switch]$Empaquetar, [switch]$ProbarPaquete)
$ErrorActionPreference = 'Stop'
$UE = 'C:\Program Files\Epic Games\UE_5.8\Engine'
$P = Split-Path $PSScriptRoot
$Proyecto = Join-Path $P 'ElMejorMedicoUE.uproject'

function Esperar-Editor { for ($i = 0; $i -lt 180; $i++) { Start-Sleep 5; if (-not (Get-Process UnrealEditor -ErrorAction SilentlyContinue)) { return } }; throw 'El editor no se ha cerrado en 15 minutos' }

if ($Compilar) {
  $log = Join-Path $P 'Saved\Compilar.log'
  & "$UE\Build\BatchFiles\Build.bat" ElMejorMedicoUEEditor Win64 Development "-Project=$Proyecto" -WaitMutex *> $log
  Get-Content $log | Select-String 'error |error:|Result:' | Select-Object -First 20
  if ($LASTEXITCODE -ne 0) { throw 'La compilación ha fallado' }
}
if ($Tarea) {
  $env:EMM_CERRAR = '1'; $env:EMM_TAREA = $Tarea
  Start-Process "$UE\Binaries\Win64\UnrealEditor.exe" -ArgumentList "`"$Proyecto`"", '-nosplash', '-unattended' | Out-Null
  Esperar-Editor
  Remove-Item Env:EMM_TAREA
  Get-Content (Join-Path $P 'Saved\Logs\ElMejorMedicoUE.log') | Select-String '\[EMM\]|LogPython: Error|fallado' | Select-Object -First 20
}
if ($Empaquetar) {
  $log = Join-Path $P 'Saved\Empaquetar_Win64.log'
  $p = Start-Process -FilePath "$UE\Build\BatchFiles\RunUAT.bat" -ArgumentList 'BuildCookRun', "-project=`"$Proyecto`"", '-platform=Win64', '-clientconfig=Development', '-build', '-cook', '-stage', '-pak', '-archive', "-archivedirectory=`"$(Join-Path $P 'Empaquetado')`"", '-unattended', '-utf8output', '-nop4' -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden -PassThru
  $p.WaitForExit()
  Get-Content $log | Select-String 'BUILD SUCCESSFUL|BUILD FAILED| Error:|LogCook: Error' | Select-Object -First 10
}
if ($ProbarPaquete) {
  $d = Join-Path $P 'Empaquetado\Windows'; $s = "$d\ElMejorMedicoUE\Saved"; $txt = "$s\Prueba.txt"
  Remove-Item $txt -ErrorAction SilentlyContinue
  Start-Process "$d\ElMejorMedicoUE.exe" -ArgumentList '-windowed', '-ResX=1600', '-ResY=900', '-EMMPrueba' | Out-Null
  for ($i = 0; $i -lt 180; $i++) { Start-Sleep 5; if (Test-Path $txt) { Start-Sleep 4; break } }
  if (Test-Path $txt) { Get-Content $txt -Encoding utf8 } else { 'La prueba no ha terminado' }
}
if ($Probar) {
  $txt = Join-Path $P 'Saved\Prueba.txt'
  Remove-Item $txt -ErrorAction SilentlyContinue
  Start-Process "$UE\Binaries\Win64\UnrealEditor.exe" -ArgumentList "`"$Proyecto`"", '-game', '-windowed', '-ResX=1600', '-ResY=900', '-EMMPrueba', '-nosplash', '-unattended' | Out-Null
  for ($i = 0; $i -lt 180; $i++) { Start-Sleep 5; if (Test-Path $txt) { Start-Sleep 4; break } }
  if (Test-Path $txt) { Get-Content $txt -Encoding utf8 } else { 'La prueba no ha terminado' }
}
