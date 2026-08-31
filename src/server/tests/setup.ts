/**
 * テスト共通のセットアップヘルパー
 */

import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { createAppServer } from '../httpServer';
import { createWebSocketServer } from '../websocketServer';

/**
 * テスト用のRedis接続を作成（モック Redis のみ使用）
 * モック Redis（ioredis-mock）を使用することで、テスト間のデータ分離と高速実行を実現
 */
export function createTestRedis(): Redis {
    // ioredis-mock を使用（各インスタンスが独立したメモリ領域を持つ）
    return new RedisMock();
}

/**
 * テスト用Redisをクリーンアップ
 */
export async function cleanupTestRedis(redis: Redis): Promise<void> {
    try {
        // DB をクリア
        await redis.flushdb();
    } finally {
        // コネクションを閉じる
        try {
            await redis.quit();
        } catch (err) {
            // quit() 失敗は許容
        }
    }
}

/**
 * テスト用サーバーを起動
 */
export async function createTestServer(redis: Redis): Promise<{
    httpServer: Server;
    wss: WebSocketServer;
    mediaService: any;
    port: number;
}> {
    // テスト用は通常のHTTPサーバーを使用（SSL証明書不要）
    const express = await import('express');
    const http = await import('http');

    const app = express.default();
    app.use(express.default.static('dist'));
    const server = http.createServer(app);

    const { wss, mediaService } = await createWebSocketServer([server], redis);

    // ランダムポートで起動
    const port = await new Promise<number>((resolve) => {
        server.listen(0, () => {
            const addr = server.address();
            const port = typeof addr === 'object' && addr ? addr.port : 0;
            resolve(port);
        });
    });

    return { httpServer: server, wss, mediaService, port };
}

/**
 * テスト用サーバーを停止
 */
export async function stopTestServer(
    httpServer: Server,
    wss: WebSocketServer,
    mediaService?: any
): Promise<void> {
    // MediaService のクリーンアップ（mediasoup Worker を閉じる）
    if (mediaService && typeof mediaService.shutdown === 'function') {
        await mediaService.shutdown();
    }

    // 残存している全WebSocket接続を強制クローズ（wss.close()がハングするのを防ぐ）
    for (const client of wss.clients) {
        client.terminate();
    }

    return new Promise((resolve) => {
        wss.close(() => {
            httpServer.close(() => {
                resolve();
            });
        });
    });
}

/**
 * WebSocketメッセージを送信して応答を待つヘルパー
 */
export function sendWSCommand(
    ws: any,
    method: string,
    params: any
): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(2, 10);
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for response: ${method}`));
        }, 5000);

        const messageHandler = (data: any) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve(response);
                }
            } catch (e) {
                // JSON parse error, ignore
            }
        };

        ws.on('message', messageHandler);
        ws.send(JSON.stringify(message));
    });
}

/**
 * 遅延ヘルパー
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
