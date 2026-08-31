# Dockerコンテナ内でテストを実行
docker compose exec -e NODE_ENV=test app npm test
