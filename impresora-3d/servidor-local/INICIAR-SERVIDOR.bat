@echo off
REM ============================================================
REM  IMPRESORA 3D - Enciende el servidor y el tunel de Cloudflare.
REM  Deja esta ventana abierta mientras quieras usar el servidor.
REM  Para apagarlo, cierra la ventana o pulsa Ctrl+C.
REM ============================================================
chcp 65001 >nul
title IMPRESORA 3D - Servidor
wsl -d Ubuntu-22.04 -u root -- bash /opt/impresora3d/servidor/iniciar.sh
pause
