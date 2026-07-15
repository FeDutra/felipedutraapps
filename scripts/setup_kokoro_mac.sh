#!/bin/bash

# Define paths
cd /Users/felipedutra/Projetos/eden-terra
RESOURCES_DIR="src-tauri/resources"
BIN_DIR="src-tauri/bin"

mkdir -p $RESOURCES_DIR
mkdir -p $BIN_DIR

# 1. Download Model Files
echo "Baixando modelos da Kokoro (se necessário)..."
if [ ! -f "$RESOURCES_DIR/kokoro-v0_19.onnx" ]; then
    echo "Fazendo download do arquivo onnx (pode levar alguns minutos)..."
    curl -L -o "$RESOURCES_DIR/kokoro-v0_19.onnx" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx"
fi

if [ ! -f "$RESOURCES_DIR/voices.bin" ]; then
    echo "Fazendo download das vozes..."
    curl -L -o "$RESOURCES_DIR/voices.bin" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.bin"
fi

# 2. Setup Virtual Environment
echo "Criando ambiente virtual (kokoro-venv)..."
rm -rf kokoro-venv
python3.11 -m venv kokoro-venv

echo "Ativando ambiente virtual e instalando dependências..."
source kokoro-venv/bin/activate
pip install --upgrade pip
pip install "numpy<2"
pip install kokoro-onnx soundfile pyinstaller

# 3. Build sidecar binary using PyInstaller
echo "Compilando o sidecar Python com PyInstaller..."
# Acha a arquitetura alvo correta (ex: x86_64-apple-darwin ou aarch64-apple-darwin)
TARGET=$(rustc -vV | grep host | awk '{print $2}')
echo "Arquitetura do Rust identificada: $TARGET"

# Cria o executável stand-alone
pyinstaller --onefile --distpath $BIN_DIR --collect-all kokoro_onnx --collect-all espeakng_loader --collect-all language_tags --name "kokoro_runner-$TARGET" src-tauri/sidecar/kokoro_runner.py

echo "========================================="
echo "Setup da Kokoro concluído!"
echo "O executável foi salvo em: $BIN_DIR/kokoro_runner-$TARGET"
echo "O modelo está em: $RESOURCES_DIR/"
echo "========================================="
