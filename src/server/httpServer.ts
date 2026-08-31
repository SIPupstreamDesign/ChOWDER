import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import path from 'path';
import fs from 'fs';

export const createAppServer = () => {
    const app = express();

    // 静的ファイルの配信（ビルド済みファイル優先）
    const publicPath = path.join(__dirname, '../../public');
    const distClientPath = path.join(__dirname, '../../dist/client');

    console.log('[HTTP Server] Static file paths:');
    console.log('  - Public:', publicPath);
    console.log('  - Dist client:', distClientPath);

    // 静的ファイル（favicon等）
    app.use(express.static(publicPath));
    // ビルド済みファイルを優先（新実装の controller.html, display.html が優先される）
    app.use(express.static(distClientPath));
    // ドキュメント
    app.use('/manual', express.static(path.join(__dirname, '../../dist/docs/manual')));

    // ルート - ランディングページ
    app.get('/', (req, res) => {
        const indexPath = path.join(distClientPath, 'index.html');
        console.log('[HTTP Server] Serving landing page from:', indexPath);
        res.sendFile(indexPath);
    });

    // HTTP サーバーは常に起動
    const httpServer = createHttpServer(app);
    console.log('Starting HTTP server');

    // SSL証明書ファイルが存在する場合のみ HTTPS サーバーも起動
    const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../../ssl/key.pem');
    const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../../ssl/cert.pem');
    let httpsServer: ReturnType<typeof createHttpsServer> | null = null;

    if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
        const sslOptions = {
            key: fs.readFileSync(sslKeyPath),
            cert: fs.readFileSync(sslCertPath),
        };
        httpsServer = createHttpsServer(sslOptions, app);
        console.log('Starting HTTPS server (SSL certificate found)');
    } else {
        console.log('SSL certificate not found - HTTPS server disabled');
    }

    console.log('Server routes configured:');
    console.log('  - Landing Page:  http://localhost:80/');
    console.log('  - Controller:    http://localhost:80/controller.html');
    console.log('  - Display:       http://localhost:80/display.html');
    if (httpsServer) {
        console.log('  - Landing Page:  https://localhost:443/');
        console.log('  - Controller:    https://localhost:443/controller.html');
        console.log('  - Display:       https://localhost:443/display.html');
    }

    return { app, httpServer, httpsServer };
};
