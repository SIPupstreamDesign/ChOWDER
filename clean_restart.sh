#!/bin/bash

# Redisデータをクリーンアップしてサーバ全体を再起動するスクリプト

set -e

echo "========================================="
echo "  ChOWDER2 Clean Restart"
echo "========================================="

# 1. Dockerコンテナを停止
echo ""
echo "[1/6] Stopping Docker containers..."
docker compose down

# 2. このプロジェクトのDockerイメージを削除（他プロジェクトには影響しない）
echo ""
echo "[2/6] Cleaning up ChOWDER2 Docker resources..."
# docker compose down --rmi local で compose.yml に定義されたサービスのイメージのみ削除
docker compose down --rmi local --volumes 2>/dev/null || true
echo "✓ ChOWDER2 Docker resources cleaned"

# 3. Redisのデータファイルを削除
echo ""
echo "[3/6] Cleaning Redis data..."
if [ -d "redis-data" ]; then
    rm -rf redis-data/dump.rdb
    rm -rf redis-data/appendonlydir/*
    echo "✓ Redis data cleaned"
else
    echo "⚠ redis-data directory not found, skipping..."
fi

# 4. ビルドディレクトリをクリーンアップ（オプション）
echo ""
echo "[4/6] Cleaning build directory..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "✓ Build directory cleaned"
else
    echo "⚠ dist directory not found, skipping..."
fi

# 5. Dockerコンテナをビルドして起動
echo ""
echo "[5/6] Building and starting Docker containers..."
docker compose up --build -d

# 6. 起動待機
echo ""
echo "[6/6] Waiting for services to start..."
sleep 3

# 起動確認
echo ""
echo "========================================="
echo "  Status Check"
echo "========================================="
docker compose ps

echo ""
echo "✓ Clean restart completed!"
echo ""
echo "Access the application at: http://localhost:8082"
echo ""
