import { ContentType } from '../content/contentTypes';

export interface ContentInspectResult {
    kind: 'image' | 'video' | 'pdf' | 'unknown';
    mime: string;
    width: number | null;
    height: number | null;
    isSupported: boolean;
    reason: string;
    needsServerProbe: boolean;
}

export function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
    if (buffer.length < 24) {
        return null;
    }
    const signature = buffer.subarray(0, 8);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!signature.equals(pngSignature)) {
        return null;
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0) {
        return null;
    }
    return { width, height };
}

export function readGifDimensions(buffer: Buffer): { width: number; height: number } | null {
    if (buffer.length < 10) {
        return null;
    }
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header !== 'GIF87a' && header !== 'GIF89a') {
        return null;
    }
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    if (width <= 0 || height <= 0) {
        return null;
    }
    return { width, height };
}

export function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        return null;
    }
    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xd9 || marker === 0xda) {
            break;
        }
        if (offset + 4 > buffer.length) {
            break;
        }
        const size = buffer.readUInt16BE(offset + 2);
        if (size < 2) {
            return null;
        }
        const isSofMarker =
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf);
        if (isSofMarker) {
            if (offset + 9 > buffer.length) {
                return null;
            }
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            if (width <= 0 || height <= 0) {
                return null;
            }
            return { width, height };
        }
        offset += 2 + size;
    }
    return null;
}

export function inspectContentSample(binary: Buffer, clientMime: string): ContentInspectResult {
    const mime = clientMime.trim().toLowerCase();
    const fallbackFromMime = (): ContentInspectResult => {
        if (mime.startsWith('image/')) {
            return {
                kind: 'image',
                mime,
                width: null,
                height: null,
                isSupported: true,
                reason: 'Detected by client MIME only',
                needsServerProbe: true,
            };
        }
        if (mime.startsWith('video/')) {
            return {
                kind: 'video',
                mime,
                width: null,
                height: null,
                isSupported: true,
                reason: 'Detected by client MIME only',
                needsServerProbe: false,
            };
        }
        if (mime === 'application/pdf') {
            return {
                kind: 'pdf',
                mime,
                width: null,
                height: null,
                isSupported: true,
                reason: 'Detected by client MIME only',
                needsServerProbe: false,
            };
        }
        return {
            kind: 'unknown',
            mime: mime || 'application/octet-stream',
            width: null,
            height: null,
            isSupported: false,
            reason: 'Unsupported or unknown format',
            needsServerProbe: false,
        };
    };

    if (binary.length >= 8) {
        const pngDim = readPngDimensions(binary);
        if (pngDim !== null) {
            return {
                kind: 'image',
                mime: 'image/png',
                width: pngDim.width,
                height: pngDim.height,
                isSupported: true,
                reason: 'Detected by PNG signature',
                needsServerProbe: false,
            };
        }
    }

    const gifDim = readGifDimensions(binary);
    if (gifDim !== null) {
        return {
            kind: 'image',
            mime: 'image/gif',
            width: gifDim.width,
            height: gifDim.height,
            isSupported: true,
            reason: 'Detected by GIF signature',
            needsServerProbe: false,
        };
    }

    const jpegDim = readJpegDimensions(binary);
    if (jpegDim !== null) {
        return {
            kind: 'image',
            mime: 'image/jpeg',
            width: jpegDim.width,
            height: jpegDim.height,
            isSupported: true,
            reason: 'Detected by JPEG signature',
            needsServerProbe: false,
        };
    }

    if (binary.length >= 5 && binary.subarray(0, 5).toString('ascii') === '%PDF-') {
        return {
            kind: 'pdf',
            mime: 'application/pdf',
            width: null,
            height: null,
            isSupported: true,
            reason: 'Detected by PDF signature',
            needsServerProbe: false,
        };
    }

    if (binary.length >= 12 && binary.subarray(4, 8).toString('ascii') === 'ftyp') {
        return {
            kind: 'video',
            mime: mime.startsWith('video/') ? mime : 'video/mp4',
            width: null,
            height: null,
            isSupported: true,
            reason: 'Detected by ISO BMFF signature',
            needsServerProbe: false,
        };
    }

    return fallbackFromMime();
}

export function normalizeIncomingContentType(typeValue: unknown): ContentType | null {
    if (typeof typeValue !== 'string') {
        return null;
    }
    const normalized = typeValue.trim().toLowerCase();
    if (normalized === ContentType.IMAGE || normalized.startsWith('image/')) {
        return ContentType.IMAGE;
    }
    if (normalized === ContentType.VIDEO || normalized.startsWith('video/')) {
        return ContentType.VIDEO;
    }
    if (normalized === ContentType.PDF || normalized === 'application/pdf') {
        return ContentType.PDF;
    }
    if (normalized === ContentType.TEXT) {
        return ContentType.TEXT;
    }
    if (normalized === ContentType.URL) {
        return ContentType.URL;
    }
    if (normalized === ContentType.WEBGL) {
        return ContentType.WEBGL;
    }
    if (normalized === ContentType.TILEIMAGE) {
        return ContentType.TILEIMAGE;
    }
    if (normalized === ContentType.LIVE_STREAM) {
        return ContentType.LIVE_STREAM;
    }
    return null;
}
