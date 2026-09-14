@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  OpenCut - Gerando novo instalador
echo ============================================

echo.
echo [1/3] Compilando o app web (producao)...
call bun run build:web
if errorlevel 1 goto :error

echo.
echo [2/3] Empacotando o instalador do Windows...
set CSC_IDENTITY_AUTO_DISCOVERY=false
cd apps\electron
call bun run dist
if errorlevel 1 goto :error
cd ..\..

echo.
echo [3/3] Copiando instalador para a Area de Trabalho...
copy /Y "apps\electron\dist\OpenCut Setup 0.1.0.exe" "%USERPROFILE%\Desktop\OpenCut Setup.exe" >nul

echo.
echo ============================================
echo  Pronto! Novo instalador em:
echo  %USERPROFILE%\Desktop\OpenCut Setup.exe
echo  (Reinstale rodando esse arquivo de novo)
echo ============================================
pause
exit /b 0

:error
echo.
echo ============================================
echo  ERRO ao gerar o instalador. Veja a mensagem acima.
echo ============================================
pause
exit /b 1
