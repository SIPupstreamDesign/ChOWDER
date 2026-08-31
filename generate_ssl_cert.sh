#!/bin/bash
# 開発環境用の自己証明書を生成するスクリプト

set -e

CERT_DIR="$(dirname "$0")/ssl"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"

mkdir -p "$CERT_DIR"

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 3650 \
  -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Dev/CN=localhost"

echo "証明書を生成しました:"
echo "  cert: $CERT_FILE"
echo "  key:  $KEY_FILE"
