@echo off
chcp 65001 >nul
echo ============================================================================
echo   SISTEMA DE CONSULTA DE CIDADAO E PRONTUARIOS - CHECKPOINT 2 (PPI)
echo   Inicializando Servidor Backend + Banco de Dados SQLite (database.db)...
echo ============================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" http://localhost:3000
    python app.py
    goto :eof
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" http://localhost:3000
    python3 app.py
    goto :eof
)

echo Python nao encontrado no PATH. Tentando iniciar com Node.js...
if not exist "node_modules" (
    echo Instalando dependencias do Node.js (express e sqlite3)...
    call npm install
)
start "" http://localhost:3000
node server.js
pause
