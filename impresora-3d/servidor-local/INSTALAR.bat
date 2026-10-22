@echo off
REM ============================================================
REM  IMPRESORA 3D - Instalador del servidor local (Windows 11)
REM  Haz doble clic en este archivo. Pedira permisos de administrador.
REM ============================================================
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
pause
