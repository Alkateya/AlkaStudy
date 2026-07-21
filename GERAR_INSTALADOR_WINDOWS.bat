@echo off
setlocal
cd /d "%~dp0"

echo =============================================
echo   AlkaStudy - Gerador para Windows
echo =============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js 22 LTS ou superior e tente novamente.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 goto :falha

call npm run desktop:dist
if errorlevel 1 goto :falha

echo.
echo CONCLUIDO. Abra a pasta release.
start "" "%~dp0release"
pause
exit /b 0

:falha
echo.
echo A geracao falhou. Fotografe ou copie o erro acima.
pause
exit /b 1
