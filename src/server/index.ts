import { createAppServer } from './httpServer';
import { createWebSocketServer } from './websocketServer';
import { createRedisClient } from './redisClient';
import { AuthService } from './auth/authService';
import { loadServerConfig } from './common/serverConfig';

const HTTP_PORT = 80;
const HTTPS_PORT = 443;

console.log('=== Starting ChOWDER Server ===');

// 非同期初期化
(async () => {
    const serverConfig = loadServerConfig();

    // Redisクライアントの作成
    const redis = createRedisClient();

    // 初期ユーザーの作成
    const authService = new AuthService(redis);
    redis.once('connect', async () => {
        await authService.initializeDefaultUser();
    });

    // HTTPサーバーの作成
    const { app, httpServer, httpsServer } = createAppServer();

    // 全サーバーリストを構築（HTTPSは証明書が存在する場合のみ）
    const servers = [httpServer, ...(httpsServer ? [httpsServer] : [])];

    // WebSocketサーバーの作成（全サーバーに共有の接続ハンドラを登録）
    const { wss } = await createWebSocketServer(servers, redis);

    // HTTP サーバー起動
    httpServer.listen(HTTP_PORT, () => {
        console.log(`HTTP Server is running on http://localhost:${HTTP_PORT}`);
    });

    // HTTPS サーバー起動（証明書が存在する場合のみ）
    if (httpsServer) {
        httpsServer.listen(HTTPS_PORT, () => {
            console.log(`HTTPS Server is running on https://localhost:${HTTPS_PORT}`);
        });
    }
})();
