# EL MEJOR MÉDICO (Unreal): mide desde Windows la memoria de vídeo y el uso de la GPU del juego mientras dura la prueba.
# Uso: medir_gpu.ps1 <nombre del proceso> <archivo de salida>   (espera a que el proceso empiece y termina cuando se cierra)
param([string]$Proceso = 'UnrealEditor', [string]$Salida = "$PSScriptRoot\..\Saved\GPU.csv")
'hora,memoria_dedicada_MB,uso_3d_pct' | Out-File $Salida -Encoding utf8
for ($i = 0; $i -lt 120 -and -not (Get-Process $Proceso -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }
while ($p = Get-Process $Proceso -ErrorAction SilentlyContinue | Select-Object -First 1) {
  try {
    $c = Get-Counter "\GPU Process Memory(pid_$($p.Id)*)\Dedicated Usage", "\GPU Engine(pid_$($p.Id)*engtype_3D)\Utilization Percentage" -ErrorAction Stop
    $mem = ($c.CounterSamples | Where-Object Path -like '*dedicated usage' | Measure-Object CookedValue -Sum).Sum / 1MB
    $uso = ($c.CounterSamples | Where-Object Path -like '*utilization percentage' | Measure-Object CookedValue -Sum).Sum
    '{0},{1:N0},{2:N0}' -f (Get-Date -Format 'HH:mm:ss'), $mem, $uso | Out-File $Salida -Append -Encoding utf8
  } catch {}
  Start-Sleep 4
}
