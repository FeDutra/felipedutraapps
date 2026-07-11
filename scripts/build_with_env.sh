#!/bin/bash
# Carrega variáveis do arquivo .env e as exporta para o ambiente do shell
if [ -f .env ]; then
  export $(cat .env | xargs)
  echo "✓ Variáveis de ambiente exportadas do arquivo .env"
else
  echo "⚠ Arquivo .env não encontrado na raiz!"
  exit 1
fi

# Roda o build do Tauri com as variáveis expostas
npm run pulso:app:build
