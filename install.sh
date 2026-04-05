#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "FATAL: node is required but was not found in PATH" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "FATAL: npm is required but was not found in PATH" >&2
  exit 1
fi

cd "$ROOT_DIR"

echo "Installing npm dependencies..."
npm install

echo "Linking todoer-cli into your npm global bin..."
npm link

echo
echo "Install complete."
echo "You can now run:"
echo "  todoer-cli"
echo
echo "If you plan to use task expansion, make sure Ollama is installed and the model is available:"
echo "  ollama run nemotron-3-nano:4b-128k"
