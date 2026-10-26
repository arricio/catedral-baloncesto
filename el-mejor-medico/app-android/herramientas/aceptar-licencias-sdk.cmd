@echo off
chcp 65001 >nul
title EL MEJOR MEDICO - licencias del SDK de Android
echo Se van a mostrar las licencias del SDK de Android de Google.
echo Leelas y escribe  y  y pulsa Intro en cada una para aceptarlas.
echo.
set "JAVA_HOME=%LOCALAPPDATA%\Programs\jdk21\jdk-21.0.12.1+1"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call "%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="%LOCALAPPDATA%\Android\Sdk" --licenses
echo.
echo Listo. Ya puedes cerrar esta ventana.
pause
