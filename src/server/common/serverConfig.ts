import * as fs from 'fs';
import * as path from 'path';

export interface TileImageConfig {
    widthThreshold: number;
    heightThreshold: number;
    tileSize: number;
}

export interface ServerConfig {
    tileImage: TileImageConfig;
}

const DEFAULT_CONFIG: ServerConfig = {
    tileImage: {
        widthThreshold: 3840,
        heightThreshold: 2160,
        tileSize: 256,
    },
};

const CONFIG_PATH = path.join(process.cwd(), 'config', 'server.json');

export function loadServerConfig(): ServerConfig {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.warn(`[ServerConfig] config/server.json not found. Using default values.`);
        return DEFAULT_CONFIG;
    }
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            tileImage: {
                widthThreshold: parsed?.tileImage?.widthThreshold ?? DEFAULT_CONFIG.tileImage.widthThreshold,
                heightThreshold: parsed?.tileImage?.heightThreshold ?? DEFAULT_CONFIG.tileImage.heightThreshold,
                tileSize: parsed?.tileImage?.tileSize ?? DEFAULT_CONFIG.tileImage.tileSize,
            },
        };
    } catch (e) {
        console.warn(`[ServerConfig] Failed to parse config/server.json. Using default values.`, e);
        return DEFAULT_CONFIG;
    }
}
