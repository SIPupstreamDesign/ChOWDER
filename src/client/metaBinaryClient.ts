/**
 * MetaBinary format for ArrayBuffer (Client-side)
 * Compatible with server-side Buffer implementation
 *
 * Format:
 * - "MetaBin:" - header string (8 bytes ASCII)
 * - version    - uint32 little-endian (4 bytes)
 * - length     - metadata length uint32 little-endian (4 bytes)
 * - metadata   - JSON string (UTF-8)
 * - binary     - binary data
 */

const HEADER_STR = "MetaBin:";
const VERSION = 1;

/**
 * UTF-8 string to Uint8Array
 */
function utf8StringToArray(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

/**
 * Uint8Array to UTF-8 string
 */
function arrayToUtf8String(array: Uint8Array): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(array);
}

/**
 * Create MetaBinary format from metadata and binary data
 *
 * @param metadata - Metadata object (will be JSON.stringify)
 * @param binary - Binary data as ArrayBuffer
 * @returns MetaBinary as ArrayBuffer
 */
export function createMetaBinary(metadata: any, binary: ArrayBuffer): ArrayBuffer {
    const metadataStr = JSON.stringify(metadata);
    const metadataBytes = utf8StringToArray(metadataStr);
    const binaryBytes = new Uint8Array(binary);

    // Calculate total size
    const headerSize = HEADER_STR.length; // 8 bytes
    const versionSize = 4; // uint32
    const lengthSize = 4; // uint32
    const totalSize = headerSize + versionSize + lengthSize + metadataBytes.length + binaryBytes.length;

    // Create buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    let pos = 0;

    // Write header "MetaBin:"
    for (let i = 0; i < HEADER_STR.length; i++) {
        uint8View[pos++] = HEADER_STR.charCodeAt(i);
    }

    // Write version (uint32 little-endian)
    view.setUint32(pos, VERSION, true);
    pos += 4;

    // Write metadata length (uint32 little-endian)
    view.setUint32(pos, metadataBytes.length, true);
    pos += 4;

    // Write metadata
    uint8View.set(metadataBytes, pos);
    pos += metadataBytes.length;

    // Write binary data
    uint8View.set(binaryBytes, pos);

    return buffer;
}

/**
 * Parse MetaBinary format
 *
 * @param buffer - MetaBinary as ArrayBuffer
 * @returns Object with metadata and binary
 */
export function parseMetaBinary(buffer: ArrayBuffer): { metadata: any; binary: ArrayBuffer } {
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    let pos = 0;

    // Read and verify header "MetaBin:"
    const headerBytes = uint8View.slice(pos, pos + HEADER_STR.length);
    const header = String.fromCharCode(...headerBytes);
    if (header !== HEADER_STR) {
        throw new Error(`Invalid MetaBinary header: expected "${HEADER_STR}", got "${header}"`);
    }
    pos += HEADER_STR.length;

    // Read version (uint32 little-endian)
    const version = view.getUint32(pos, true);
    pos += 4;
    if (version !== VERSION) {
        console.warn(`MetaBinary version mismatch: expected ${VERSION}, got ${version}`);
    }

    // Read metadata length (uint32 little-endian)
    const metadataLength = view.getUint32(pos, true);
    pos += 4;

    // Read metadata
    const metadataBytes = uint8View.slice(pos, pos + metadataLength);
    const metadataStr = arrayToUtf8String(metadataBytes);
    const metadata = JSON.parse(metadataStr);
    pos += metadataLength;

    // Read binary data (remaining bytes)
    const binary = buffer.slice(pos);

    return { metadata, binary };
}

/**
 * Convert ArrayBuffer to Base64 string (for HTML img src)
 *
 * @param buffer - ArrayBuffer to convert
 * @returns Base64 encoded string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 *
 * @param base64 - Base64 encoded string
 * @returns ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
