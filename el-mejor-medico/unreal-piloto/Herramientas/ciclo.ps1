# EL MEJOR MÉDICO (Unreal): ciclo de trabajo en el portátil.
#   -Compilar     compila el C++ del editor
#   -Tarea x.py   ejecuta Herramientas/x.py dentro del editor (se cierra solo)
#   -Probar       abre el juego (1600×900) con la prueba automática: fotos en Saved/Capturas y conversación en Saved/Prueba.txt
#   -Empaquetar   empaqueta la versión de Windows en Empaquetado/Windows (sombreadores ya compilados)
#   -ProbarPaquete  la prueba automática con el juego empaquetado (lo que recibirá el usuario)
#   -Android      empaqueta el APK de Android (arm64 para el móvil y x86_64 para el emulador): Binaries/Android y Saved/StagedBuilds/Android
#   -Calidad N    fuerza la calidad gráfica en la prueba (0 rápida, 1 equilibrada, 2 alta) sin tocar la guardada
param([switch]$Compilar, [string]$Tarea, [switch]$Probar, [switch]$Empaquetar, [switch]$ProbarPaquete, [switch]$Montaje, [switch]$Todos, [int]$Calidad = -1, [switch]$Android)
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
  # Smart App Control (activado; no se desactiva) puede bloquear la DLL nueva del editor durante el «cook»
  $cook = Get-ChildItem "$env:APPDATA\Unreal Engine\AutomationTool\Logs" -Recurse -Filter 'Cook*.txt' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($cook -and $cook.LastWriteTime -gt $p.StartTime -and (Select-String -Path $cook.FullName -Pattern 'GetLastError=4551' -Quiet)) { 'BLOQUEADO por Smart App Control (4551): recompila con un cambio de código y vuelve a empaquetar' }
}
if ($Android) {
  # SDK, NDK y JDK gratuitos ya instalados (Android SDK de Google, NDK r27c, Temurin 21)
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; $env:NDKROOT = "$env:ANDROID_HOME\ndk\27.2.12479018"; $env:NDK_ROOT = $env:NDKROOT
  $env:JAVA_HOME = (Get-ChildItem "$env:LOCALAPPDATA\Programs\jdk21" -Directory | Select-Object -First 1).FullName
  $log = Join-Path $P 'Saved\Empaquetar_Android.log'
  $p = Start-Process -FilePath "$UE\Build\BatchFiles\RunUAT.bat" -ArgumentList 'BuildCookRun', "-project=`"$Proyecto`"", '-platform=Android', '-cookflavor=ASTC', '-clientconfig=Development', '-build', '-cook', '-stage', '-pak', '-package', '-unattended', '-utf8output', '-nop4' -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden -PassThru
  $p.WaitForExit()
  Get-Content $log | Select-String 'BUILD SUCCESSFUL|BUILD FAILED| Error:|error:|LogCook: Error|ERROR:' | Select-Object -First 25
}
if ($ProbarPaquete) {
  $d = Join-Path $P 'Empaquetado\Windows'; $s = "$d\ElMejorMedicoUE\Saved"; $txt = "$s\Prueba.txt"
  Remove-Item $txt -ErrorAction SilentlyContinue
  $inicio = Get-Date
  $extraP = if ($Todos) { '-EMMTodos' } else { '-nada' }
  $cal = if ($Calidad -ge 0) { "-EMMCalidad=$Calidad" } else { '-nada' }
  Start-Process "$d\ElMejorMedicoUE.exe" -ArgumentList '-windowed', '-ResX=1600', '-ResY=900', '-EMMPrueba', $extraP, $cal | Out-Null
  for ($i = 0; $i -lt 180; $i++) {
    Start-Sleep 5; if (Test-Path $txt) { Start-Sleep 4; break }
    # Smart App Control (activado; no se desactiva) puede bloquear un binario nuevo: se avisa en vez de esperar
    $bloqueo = Get-WinEvent -LogName 'Microsoft-Windows-CodeIntegrity/Operational' -MaxEvents 20 -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq 3077 -and $_.TimeCreated -gt $inicio -and $_.Message -like '*Empaquetado*' }
    if ($bloqueo) { Get-Process ElMejorMedicoUE* -ErrorAction SilentlyContinue | Stop-Process -Force; 'BLOQUEADO por Smart App Control: vuelve a empaquetar con un cambio de código'; break }
  }
  if (Test-Path $txt) { Get-Content $txt -Encoding utf8 } else { 'La prueba no ha terminado' }
}
if ($Probar) {
  $txt = Join-Path $P 'Saved\Prueba.txt'
  Remove-Item $txt -ErrorAction SilentlyContinue
  $extra = if ($Montaje) { '-EMMSoloMontaje' } elseif ($Todos) { '-EMMTodos' } else { '-nada' }
  $cal = if ($Calidad -ge 0) { "-EMMCalidad=$Calidad" } else { '-nada' }
  Start-Process "$UE\Binaries\Win64\UnrealEditor.exe" -ArgumentList "`"$Proyecto`"", '-game', '-windowed', '-ResX=1600', '-ResY=900', '-EMMPrueba', $extra, $cal, '-nosplash', '-unattended' | Out-Null
  for ($i = 0; $i -lt 540; $i++) {
    Start-Sleep 5; if (Test-Path $txt) { Start-Sleep 4; break }
    # Smart App Control (activado; no se desactiva) puede bloquear la DLL recién compilada: se avisa en vez de esperar
    if ($i -gt 6 -and -not (Get-Process UnrealEditor -ErrorAction SilentlyContinue) -and (Select-String -Path (Join-Path $P 'Saved\Logs\ElMejorMedicoUE.log') -Pattern 'GetLastError=4551' -Quiet)) { 'BLOQUEADO por Smart App Control (4551): recompila con un cambio de código'; break }
  }
  if (Test-Path $txt) { Get-Content $txt -Encoding utf8 } else { 'La prueba no ha terminado' }
}
