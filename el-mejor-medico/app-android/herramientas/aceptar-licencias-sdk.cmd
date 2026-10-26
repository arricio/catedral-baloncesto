@echo off
setlocal
chcp 65001 >nul
title EL MEJOR MEDICO - licencias del SDK de Android
rem Busca Java 21 y sdkmanager.bat; si faltan, los descarga (con comprobacion SHA-256) y despues
rem muestra las licencias del SDK de Android para que las aceptes tu. Deja un registro en licencias-sdk.log.
set "LOG=%~dp0licencias-sdk.log"
echo [%date% %time%] Inicio. Usuario: %USERNAME%  LOCALAPPDATA: %LOCALAPPDATA% > "%LOG%"

rem ---------- 1. Java 21 ----------
set "JDK="
if exist "%JAVA_HOME%\bin\java.exe" set "JDK=%JAVA_HOME%"
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JDK=%ProgramFiles%\Android\Android Studio\jbr"
for /d %%D in ("%LOCALAPPDATA%\Programs\jdk21\jdk-21*") do if exist "%%D\bin\java.exe" set "JDK=%%D"
if defined JDK goto jdk_ok
echo No encuentro Java 21. Lo descargo de Adoptium (unos 200 MB)...
set "ZIP=%TEMP%\emm-jdk21.zip"
curl.exe -L --fail -o "%ZIP%" "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip" || goto err_descarga
certutil -hashfile "%ZIP%" SHA256 | findstr /i "f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e" >nul || goto err_hash
if not exist "%LOCALAPPDATA%\Programs\jdk21" mkdir "%LOCALAPPDATA%\Programs\jdk21"
tar.exe -xf "%ZIP%" -C "%LOCALAPPDATA%\Programs\jdk21" || goto err_descomprimir
del "%ZIP%"
set "JDK=%LOCALAPPDATA%\Programs\jdk21\jdk-21.0.12.1+1"
:jdk_ok
set "JAVA_HOME=%JDK%"
set "PATH=%JDK%\bin;%PATH%"
echo Java: %JDK%
echo Java: %JDK% >> "%LOG%"

rem ---------- 2. SDK de Android y sdkmanager.bat ----------
set "SDK="
if exist "%ANDROID_SDK_ROOT%\" set "SDK=%ANDROID_SDK_ROOT%"
if exist "%ANDROID_HOME%\" set "SDK=%ANDROID_HOME%"
if not defined SDK set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "SDKM="
for /d %%D in ("%SDK%\cmdline-tools\*") do if exist "%%D\bin\sdkmanager.bat" set "SDKM=%%D\bin\sdkmanager.bat"
if exist "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" set "SDKM=%SDK%\cmdline-tools\latest\bin\sdkmanager.bat"
if defined SDKM goto sdkm_ok
echo No encuentro sdkmanager.bat. Descargo las herramientas del SDK de Google (unos 150 MB)...
set "ZIP=%TEMP%\emm-cmdline-tools.zip"
curl.exe -L --fail -o "%ZIP%" "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip" || goto err_descarga
certutil -hashfile "%ZIP%" SHA256 | findstr /i "90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a" >nul || goto err_hash
if exist "%SDK%\cmdline-tools\_nuevo" rmdir /s /q "%SDK%\cmdline-tools\_nuevo"
mkdir "%SDK%\cmdline-tools\_nuevo"
tar.exe -xf "%ZIP%" -C "%SDK%\cmdline-tools\_nuevo" || goto err_descomprimir
move "%SDK%\cmdline-tools\_nuevo\cmdline-tools" "%SDK%\cmdline-tools\latest" >nul || goto err_descomprimir
rmdir "%SDK%\cmdline-tools\_nuevo"
del "%ZIP%"
set "SDKM=%SDK%\cmdline-tools\latest\bin\sdkmanager.bat"
:sdkm_ok
echo SDK: %SDK%
echo sdkmanager: %SDKM%
echo SDK: %SDK% >> "%LOG%"
echo sdkmanager: %SDKM% >> "%LOG%"

rem ---------- 3. Licencias ----------
echo.
echo Ahora se mostraran las licencias del SDK de Android de Google.
echo A la pregunta "Review licenses that have not been accepted (y/N)?" escribe  y  y pulsa Intro.
echo Despues lee cada licencia y, si estas de acuerdo, escribe  y  y pulsa Intro en cada una.
echo.
call "%SDKM%" --sdk_root="%SDK%" --licenses
echo.
if exist "%SDK%\licenses\android-sdk-license" goto aceptadas
echo Las licencias NO han quedado aceptadas. Vuelve a abrir este archivo y responde  y  a todas.
echo [%date% %time%] Licencias NO aceptadas >> "%LOG%"
goto fin
:aceptadas
echo LISTO: las licencias estan aceptadas. Vuelve al chat de Claude y escribe que ya estan aceptadas.
echo [%date% %time%] Licencias aceptadas >> "%LOG%"
goto fin

:err_descarga
echo ERROR: no se ha podido descargar. Comprueba la conexion a Internet y vuelve a intentarlo.
echo [%date% %time%] Error de descarga >> "%LOG%"
goto fin
:err_hash
echo ERROR: el archivo descargado no coincide con la huella SHA-256 esperada. No se ha instalado.
echo [%date% %time%] Huella SHA-256 incorrecta >> "%LOG%"
del "%ZIP%" 2>nul
goto fin
:err_descomprimir
echo ERROR: no se ha podido descomprimir el archivo descargado.
echo [%date% %time%] Error al descomprimir >> "%LOG%"
goto fin

:fin
echo.
echo Registro guardado en: %LOG%
pause
