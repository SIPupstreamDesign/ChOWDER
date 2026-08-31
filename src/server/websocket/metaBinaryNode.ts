/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

/**
 * MetaBinary format (Node.js Buffer version, server-side)
 *
 * format -------------------------------------------------
 * -  "MetaBin:"           - header string (string)
 * -  1                      - version (uint32)
 * -  78                      - metadata's length (uint32)
 * -  { id: 1, posx: 0, ...}  - metadata (json string)
 * -  0xfefefe                - binarydata (blob)
 * --------------------------------------------------------
 */

const HEADER_STR = 'MetaBin:';

/**
 * UTF8文字列をUint8Arrayに変換
 */
function utf8StringToArray(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

/**
 * Uint8ArrayをUTF8文字列に変換
 */
function arrayToUtf8String(arr: Uint8Array): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(arr);
}

/**
 * メタバイナリの作成
 */
export function createMetaBinary(metaData: any, binary: Buffer): Buffer {
    const metaStr = utf8StringToArray(JSON.stringify(metaData));

    const headerBytes = Buffer.from(HEADER_STR, 'ascii');
    const buffer = Buffer.alloc(
        headerBytes.length + 8 + metaStr.length + binary.length
    );

    let pos = 0;

    // headerStr
    headerBytes.copy(buffer, pos);
    pos += headerBytes.length;

    // version
    buffer.writeUInt32LE(1, pos);
    pos += 4;

    // metadata length
    buffer.writeUInt32LE(metaStr.length, pos);
    pos += 4;

    // metadata
    Buffer.from(metaStr).copy(buffer, pos);
    pos += metaStr.length;

    // binary
    binary.copy(buffer, pos);

    return buffer;
}

/**
 * メタバイナリの作成（複数対応 ver2）
 */
export function createMetaBinaryMulti(
    metaData: any,
    metaDataList: any[],
    binaryList: Buffer[]
): Buffer | null {
    if (!metaDataList || metaDataList.length <= 0 ||
        !binaryList || binaryList.length <= 0 ||
        metaDataList.length !== binaryList.length) {
        console.error('wrong metabinary multi input');
        return null;
    }

    const metaStr = utf8StringToArray(JSON.stringify(metaData));
    const metaStrList: Uint8Array[] = [];
    let totalMetaSize = 0;
    let totalBinarySize = 0;

    for (const binary of binaryList) {
        totalBinarySize += binary.length;
    }

    for (const meta of metaDataList) {
        const tmpStr = utf8StringToArray(JSON.stringify(meta));
        metaStrList.push(tmpStr);
        totalMetaSize += tmpStr.length;
    }

    const headerBytes = Buffer.from(HEADER_STR, 'ascii');
    const buffer = Buffer.alloc(
        headerBytes.length +
        4 + // version
        4 + // metaStr.length
        metaStr.length +
        4 + // metaDataList/binaryList count
        4 * metaStrList.length +
        totalMetaSize +
        4 * binaryList.length +
        totalBinarySize
    );

    let pos = 0;

    // headerStr
    headerBytes.copy(buffer, pos);
    pos += headerBytes.length;

    // version
    buffer.writeUInt32LE(2, pos);
    pos += 4;

    // metadata length
    buffer.writeUInt32LE(metaStr.length, pos);
    pos += 4;

    // metadata
    Buffer.from(metaStr).copy(buffer, pos);
    pos += metaStr.length;

    // metaDataList/binaryList count
    buffer.writeUInt32LE(metaDataList.length, pos);
    pos += 4;

    // binaryList
    for (let i = 0; i < binaryList.length; i++) {
        const meta = metaStrList[i];
        const binary = binaryList[i];

        // metadata length
        buffer.writeUInt32LE(meta.length, pos);
        pos += 4;

        // metadata
        Buffer.from(meta).copy(buffer, pos);
        pos += meta.length;

        // binary length
        buffer.writeUInt32LE(binary.length, pos);
        pos += 4;

        // binary
        binary.copy(buffer, pos);
        pos += binary.length;
    }

    return buffer;
}

/**
 * メタバイナリのロード
 */
export function loadMetaBinary(
    binary: Buffer,
    endCallback: (metaData: any, content: Buffer | string) => void
): void {
    const head = binary.slice(0, HEADER_STR.length).toString('ascii');
    if (head !== HEADER_STR) {
        return;
    }

    const version = binary.slice(HEADER_STR.length, HEADER_STR.length + 4).readUInt32LE(0);
    const metaSize = binary.slice(HEADER_STR.length + 4, HEADER_STR.length + 8).readUInt32LE(0);
    const metaData = JSON.parse(
        binary.slice(HEADER_STR.length + 8, HEADER_STR.length + 8 + metaSize).toString()
    );

    let params: any;
    if (metaData.hasOwnProperty('params')) {
        params = metaData.params;
    } else if (metaData.hasOwnProperty('result')) {
        params = metaData.result;
    } else if (metaData.hasOwnProperty('param')) {
        params = metaData.param;
    }

    let content: Buffer | string = binary.slice(HEADER_STR.length + 8 + metaSize);

    if (params && (params.type === 'text' || params.type === 'url' || params.type === 'layout')) {
        content = content.toString('utf8');
    }

    if (metaData && content) {
        endCallback(metaData, content);
    }
}
