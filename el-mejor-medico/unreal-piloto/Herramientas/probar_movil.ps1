# EL MEJOR MÉDICO (Unreal): prueba automática en el móvil por USB (adb). El móvil tiene que estar desbloqueado,
# con la pantalla encendida y el juego delante. Usa el historial de prueba (no toca la partida del jugador).
#   -Modo '-EMMTodos -EMMSoloNinos' | '-EMMCreador' | '-EMMTodos' …   -Nombre ninos   (Saved/Prueba_Xiaomi_<Nombre>.txt)
param([string]$Modo = '-EMMTodos', [string]$Nombre = 'todos', [int]$Minutos = 20, [string]$Movil = '1ecc5f83')
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$d = '/sdcard/Android/data/es.elmejormedico.ue/files/UnrealGame/ElMejorMedicoUE'
$P = Split-Path $PSScriptRoot
& $adb -s $Movil shell am force-stop es.elmejormedico.ue
& $adb -s $Movil shell "echo ' -EMMPrueba $Modo' > $d/UECommandLine.txt; rm -f $d/ElMejorMedicoUE/Saved/Prueba.txt; rm -rf $d/ElMejorMedicoUE/Saved/Capturas"
& $adb -s $Movil logcat -c
& $adb -s $Movil shell monkey -p es.elmejormedico.ue -c android.intent.category.LAUNCHER 1 *> $null
$t0 = Get-Date; $fin = 'tiempo agotado'
while (((Get-Date) - $t0).TotalMinutes -lt $Minutos) {
  Start-Sleep 15
  if (& $adb -s $Movil shell "ls $d/ElMejorMedicoUE/Saved/Prueba.txt 2>/dev/null") { Start-Sleep 5; $fin = 'terminada'; break }
  if (-not (& $adb -s $Movil shell pidof es.elmejormedico.ue)) { $fin = 'el juego se ha cerrado'; break }
  $foco = & $adb -s $Movil shell "dumpsys window | grep mCurrentFocus"
  if ($foco -notmatch 'elmejormedico') { $fin = "el juego no está delante ($foco)"; break }
}
$min = [math]::Round(((Get-Date) - $t0).TotalMinutes, 1)
"Prueba $Modo`: $fin tras $min min"
& $adb -s $Movil shell rm -f "$d/UECommandLine.txt"
$txt = Join-Path $P "Saved\Prueba_Xiaomi_$Nombre.txt"
Remove-Item $txt -ErrorAction SilentlyContinue
& $adb -s $Movil pull "$d/ElMejorMedicoUE/Saved/Prueba.txt" $txt 2>$null | Out-Null
$cap = Join-Path $P "Saved\Capturas_Xiaomi_$Nombre"
Remove-Item $cap -Recurse -ErrorAction SilentlyContinue
& $adb -s $Movil pull "$d/ElMejorMedicoUE/Saved/Capturas" $cap 2>$null | Out-Null
if (Test-Path $txt) { Get-Content $txt -Encoding utf8 } else { 'Sin Prueba.txt' }
