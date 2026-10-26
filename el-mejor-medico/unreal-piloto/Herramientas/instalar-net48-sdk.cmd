@echo off
chcp 65001 >nul
title EL MEJOR MEDICO - componente .NET Framework 4.8 SDK para Unreal
echo Unreal Engine necesita el componente gratuito ".NET Framework 4.8 SDK" de Visual Studio para compilar.
echo Windows te pedira permiso de administrador: pulsa "Si".
echo.
"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\setup.exe" modify --installPath "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools" --add Microsoft.Net.Component.4.8.SDK --passive --norestart
echo.
if exist "%ProgramFiles(x86)%\Windows Kits\NETFXSDK\4.8" (echo LISTO: el componente esta instalado. Vuelve al chat de Claude.) else (echo Si sigue abierta la ventana del instalador de Visual Studio, espera a que termine y vuelve al chat de Claude.)
pause
