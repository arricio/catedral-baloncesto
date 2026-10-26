@echo off
chcp 65001 >nul
title EL MEJOR MEDICO - servidor para el movil
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encuentra Node.js. Instalalo desde https://nodejs.org ^(gratis^) y vuelve a abrir este archivo.
  pause
  exit /b 1
)
rem Si Ollama esta instalado pero cerrado, se abre (no descarga nada).
powershell -NoProfile -Command "try { Invoke-RestMethod http://127.0.0.1:11434/api/version -TimeoutSec 2 | Out-Null } catch { $o = Get-Command ollama -ErrorAction SilentlyContinue; if ($o) { Start-Process $o.Source -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep 3 } }"
node herramientas\servidor-movil.js %*
pause
