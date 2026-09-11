@echo off
echo ========================================
echo   Despesas Webapp - Setup & Start
echo ========================================
echo.

echo [1/4] Configurando Backend...
cd backend
if not exist .env (
    echo Criando .env a partir de .env.example...
    copy .env.example .env
    echo Editar .env com as tuas configuracoes
)
if not exist node_modules (
    echo Instalando dependencias do backend...
    call npm install
)
echo Backend configurado!
echo.

echo [2/4] Iniciando Backend...
start cmd /k "npm run dev"
echo Backend iniciando em http://localhost:3000
echo.

echo [3/4] Configurando Frontend...
cd ..\frontend
if not exist .env.local (
    echo Criando .env.local a partir de .env.local.example...
    copy .env.local.example .env.local
    echo Editar .env.local com a URL da API
)
if not exist node_modules (
    echo Instalando dependencias do frontend...
    call npm install
)
echo Frontend configurado!
echo.

echo [4/4] Iniciando Frontend...
start cmd /k "npm run dev"
echo Frontend iniciando em http://localhost:3000
echo.

echo ========================================
echo   Setup concluido!
echo ========================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:3000
echo.
echo Abre http://localhost:3000 no browser
echo.
echo Pressiona qualquer tecla para fechar...
pause >nul
