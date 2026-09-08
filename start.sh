#!/bin/bash

echo "========================================"
echo "  Despesas Webapp - Setup & Start"
echo "========================================"
echo ""

echo "[1/4] Configurando Backend..."
cd backend
if [ ! -f .env ]; then
    echo "Criando .env a partir de .env.example..."
    cp .env.example .env
    echo "Editar .env com as tuas configuracoes"
fi
if [ ! -d node_modules ]; then
    echo "Instalando dependencias do backend..."
    npm install
fi
echo "Backend configurado!"
echo ""

echo "[2/4] Iniciando Backend..."
npm run dev &
BACKEND_PID=$!
echo "Backend iniciando em http://localhost:3000"
echo ""

echo "[3/4] Configurando Frontend..."
cd ../frontend
if [ ! -f .env.local ]; then
    echo "Criando .env.local a partir de .env.local.example..."
    cp .env.local.example .env.local
    echo "Editar .env.local com a URL da API"
fi
if [ ! -d node_modules ]; then
    echo "Instalando dependencias do frontend..."
    npm install
fi
echo "Frontend configurado!"
echo ""

echo "[4/4] Iniciando Frontend..."
npm run dev &
FRONTEND_PID=$!
echo "Frontend iniciando em http://localhost:3000"
echo ""

echo "========================================"
echo "  Setup concluido!"
echo "========================================"
echo ""
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Abre http://localhost:3000 no browser"
echo ""
echo "Pressiona Ctrl+C para parar"
echo ""

# Wait for user to stop
wait $BACKEND_PID $FRONTEND_PID
