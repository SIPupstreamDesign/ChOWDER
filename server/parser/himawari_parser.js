const fs = require('fs');

class Reader {
    constructor(byteOrder) {
        this.byteOrder = byteOrder;
        if (this.byteOrder === 1) {
            this.readFloat = (buf) => { return buf.readFloatBE(); }
            this.readDouble = (buf) => { return buf.readDoubleBE(); }
            this.readUInt16 = (buf) => { return buf.readUInt16BE(); }
            this.readUInt32 = (buf) => { return buf.readUInt32BE(); }
        } else {
            this.readFloat = (buf) => { return buf.readFloatLE(); }
            this.readDouble = (buf) => { return buf.readDoubleLE(); }
            this.readUInt16 = (buf) => { return buf.readUInt16LE(); }
            this.readUInt32 = (buf) => { return buf.readUInt32LE(); }
        }
        this.readUInt8 = (buf) => { return buf.readUInt8(); }
    }
}
let reader = null;

/// Block基底
class Block {
    constructor(bufferSize_) {
        this.bufferSize = bufferSize_;
        this.buffer = new Buffer(this.bufferSize);
    }

    parse(fd, start) {
        return new Promise((resolve, reject) => {
            let bytes = 0;

            fs.read(fd, this.getBuffer(), 0, this.getBufferSize(), start, (err, bytesRead, buf) => {
                if (err) { reject(err); }

                bytes += bytesRead;

                if (bytes === this.getBufferSize()) {
                    try {
                        if (this.parseBuffer(buf, fd, start, resolve) !== false) {
                            resolve(start + this.getBufferSize());
                        }
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        });
    }
    getBuffer() {
        return this.buffer;
    }

    getBufferSize() {
        return this.bufferSize;
    }

    // override this and parse buf
    parseBuffer(buf, fd = null, start = -1, resolve = null) {
        throw ("override this and parse buf");
    }
}

/// #1 基本情報ブロック
class Header1 extends Block {
    constructor() {
        super(282);

        this.data = {
            headerBlockNumber: 1, // 固定
            blockLength: 282,  // 固定
            headerBlockCount: 11, // 固定
            byteOrder: 1,
            satelliteName: "",
            processingCenterName: "",
            observationArea: "",
            otherObservationInformation: "",
            observationTimeline: 0,
            observationStartTime: 0,
            observationEndTime: 0,
            fileCreationTime: 0,
            totalHeaderLength: 0,
            totalDataLength: 0,
            qualityFlag1: 0,
            qualityFlag2: 0,
            qualityFlag3: 0,
            qualityFlag4: 0,
            fileFormatVersion: "",
            fileName: ""
        };
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = buf.readUInt8(); // 固定
        // this.data.blockLength = buf.readUInt16BE(); // 固定
        // this.data.headerBlockCount = buf.readUInt16BE(); // 固定
        pos += 5;
        this.data.byteOrder = buf.slice(pos, pos + 1).readUInt8();
        reader = new Reader(this.data.byteOrder);

        pos += 1;
        this.data.satelliteName = buf.slice(pos, pos + 16).toString().split("\u0000").join('');
        pos += 16;
        this.data.processingCenterName = buf.slice(pos, pos + 16).toString().split("\u0000").join('');
        pos += 16;
        this.data.observationArea = buf.slice(pos, pos + 4).toString();
        pos += 4;
        this.data.otherObservationInformation = buf.slice(pos, pos + 2).toString();
        pos += 2;
        this.data.observationTimeline = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.observationStartTime = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.observationEndTime = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.fileCreationTime = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.totalHeaderLength = reader.readUInt32(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.totalDataLength = reader.readUInt32(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.qualityFlag1 = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
        this.data.qualityFlag2 = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
        this.data.qualityFlag3 = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
        this.data.qualityFlag4 = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
        this.data.fileFormatVersion = buf.slice(pos, pos + 32).toString().split("\u0000").join('');
        pos += 32;
        this.data.fileName = buf.slice(pos, pos + 128).toString().split("\u0000").join('');
        pos += 128;
    }
}

/// #2 データ情報ブロック
class Header2 extends Block {
    constructor() {
        super(50);

        this.data = {
            headerBlockNumber: 2, // 固定
            blockLength: 50, // 固定
            bpp: 16, // 固定
            numberOfColumns: 0,
            numberOfLines: 0,
            compressionFlag: 0
        };
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        // this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        // this.data.bpp = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        this.data.numberOfColumns = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.numberOfLines = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.compressionFlag = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
    }
}

/// #3 投影情報ブロック
class Header3 extends Block {
    constructor() {
        super(127);

        this.data = {
            headerBlockNumber: 3, // 固定
            blockLength: 127, // 固定,
            sub_lon: 0.0,
            CFAC: 0,
            LFAC: 0,
            COFF: 0.0,
            LOFF: 0.0,
            Rs: 42164, // 固定,
            Req: 6378.1370, // 固定,
            Rpol: 6356.7523, // 固定,
            Rval11: 0.00669438444, // 固定,
            Rval12: 0.993305616, // 固定,
            Rval13: 1.006739501, // 固定,
            Sd: 1737122264, // 固定,
            resamplingTypes: 0,
            resamplingSize: 0
        };
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        // this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        this.data.sub_lon = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.CFAC = reader.readUInt32(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.LFAC = reader.readUInt32(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.COFF = reader.readFloat(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.LOFF = reader.readFloat(buf.slice(pos, pos + 4));
        pos += 4;
        // this.data.Rs = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // this.data.Req = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // this.data.Rpol = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // this.data.Rval11 = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // this.data.Rval12 = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // this.data.Rval13 = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // this.data.Sd = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.resamplingTypes = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.resamplingSize = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
    }
}

/// #4 ナビゲーション情報ブロック
class Header4 extends Block {
    constructor() {
        super(139);

        this.data = {
            headerBlockNumber: 4, // 固定
            blockLength: 139, // 固定,
            informationTime: 0.0,
            SSPlon: 0.0,
            SSPlat: 0.0,
            distance: 0.0,
            nadir5lon: 0.0,
            nadirlat: 0.0,
            sunPos: 0.0,
            moonPos: 0.0,
        }
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        // this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        this.data.informationTime = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.SSPlon = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.SSPlat = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.distance = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.nadir5lon = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.nadirlat = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.sunPos = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.moonPos = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
    }
}

/// #5 キャリブレーション情報ブロック
class Header5 extends Block {
    constructor() {
        super(147);

        this.data = {
            headerBlockNumber: 5, // 固定
            blockLength: 147, // 固定,
            bandNumber: 0,
            centralWaveLength: 0.0,
            validNumOfBpp: 0,
            countOfErrorPixels: 0,
            countOfPixelsOutsideScanArea: 0,
            gainForCountRadiance: 0.0,
            constantForCountRadiance: 0.0
        }
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        // this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        this.data.bandNumber = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.centralWaveLength = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.validNumOfBpp = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.countOfErrorPixels = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.countOfPixelsOutsideScanArea = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
        this.data.gainForCountRadiance = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.constantForCountRadiance = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        // 赤外バンド（バンド番号 7-16）の場合
        if (this.data.bandNumber >= 7 && this.data.bandNumber <= 16) {
            this.data.c0 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.c1 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.c2 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.C0 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.C1 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.C2 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.c = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.h = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.k = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
        } else if (this.data.bandNumber >= 1 && this.data.bandNumber <= 6) {
            this.data.cdash = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.detectedTime = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.coeff1 = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;
            this.data.constConversionVal = reader.readDouble(buf.slice(pos, pos + 8));
            pos += 8;

        } else {
            throw ("Faild for Band Number: " + this.data.bandNumber);
        }
    }
}

/// #6 インターキャリブレーション情報ブロック
class Header6 extends Block {
    constructor() {
        super(259);

        this.data = {
            headerBlockNumber: 6, // 固定
            blockLength: 259, // 固定,
            GSICSCoeffConst: 0.0,
            GSICSCoeff1: 0.0,
            GSICSCoeff2: 0.0,
            radianceBias: 0.0,
            radianceBiasError: 0.0,
            radianceBase: 0.0,
            startTimeOfGSICS: 0.0,
            endTimeOfGSICS: 0.0,
            upperLimitOfRadianceValidity: 0.0,
            lowerLimitOfRadianceValidity: 0.0,
            GSICSFileName: ""
        };
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        // this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        this.data.GSICSCoeffConst = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.GSICSCoeff1 = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.GSICSCoeff2 = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.radianceBias = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.radianceBiasError = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.radianceBase = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.startTimeOfGSICS = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.endTimeOfGSICS = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.upperLimitOfRadianceValidity = reader.readFloat(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.lowerLimitOfRadianceValidity = reader.readFloat(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.GSICSFileName = buf.slice(pos, pos + 128).toString().split("\u0000").join('');
    }
}

/// #7 セグメント情報ブロック
class Header7 extends Block {
    constructor() {
        super(47);

        this.data = {
            headerBlockNumber: 7, // 固定
            blockLength: 47, // 固定,
            totalSegments: 0,
            segmentNumber: 0,
            firstLineNumberOfSegment: 0,
        };
    }

    parseBuffer(buf) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        // this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 固定
        pos += 2;
        this.data.totalSegments = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
        this.data.segmentNumber = reader.readUInt8(buf.slice(pos, pos + 1));
        pos += 1;
        this.data.firstLineNumberOfSegment = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;
    }
}

/// #8 位置補正情報ブロック
class Header8 extends Block {
    constructor() {
        super(21); // 変動データを含むので, numOfDataまで読み込み

        this.data = {
            headerBlockNumber: 7, // 固定
            blockLength: 0, // 変動,
            centerColumnOfRot: 0.0,
            centerLineOfRot: 0.0,
            rotationalAmount: 0.0,
            numOfData: 0,
            lineNumber: [],
            columnDirectionShifts: [],
            lineDirectionShifts: [],
        };
    }

    parseBuffer(buf, fd, start, resolve) {
        let pos = 0;
        // this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 変動
        pos += 2;
        this.data.centerColumnOfRot = reader.readFloat(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.centerLineOfRot = reader.readFloat(buf.slice(pos, pos + 4));
        pos += 4;
        this.data.rotationalAmount = reader.readDouble(buf.slice(pos, pos + 8));
        pos += 8;
        this.data.numOfData = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;

        this.bufferSize = this.data.blockLength; // 上書き
        let restDataSize = this.data.blockLength - pos; // 残りのデータ
        let buffer = new Buffer(restDataSize);
        let bytes = 0;
        fs.read(fd, buffer, 0, restDataSize, start + pos, (err, bytesRead, buf) => {

            bytes += bytesRead;

            if (bytes === restDataSize) {
                let pos = 0;
                for (let i = 0; i < this.data.numOfData; ++i) {
                    this.data.lineNumber.push(reader.readUInt16(buf.slice(pos, pos + 2)));
                    pos += 2;
                    this.data.columnDirectionShifts.push(reader.readFloat(buf.slice(pos, pos + 4)));
                    pos += 4;
                    this.data.lineDirectionShifts.push(reader.readFloat(buf.slice(pos, pos + 4)));
                    pos += 4;
                }
                resolve(start + this.getBufferSize());
            }
        });
        return false; // block resolve
    }
}

/// #9 観測時刻情報ブロック
class Header9 extends Block {
    constructor() {
        super(5); // observationTimeCountまで読み込み

        this.data = {
            headerBlockNumber: 7, // 固定
            blockLength: 0, // 変動,
            observationTimeCount: 0,
            lineNumber: [],
            observationTime: [],
        };
    }

    parseBuffer(buf, fd, start, resolve) {
        let pos = 0;
        this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        this.data.blockLength = reader.readUInt16(buf.slice(pos, pos + 2)); // 変動
        pos += 2;
        this.data.observationTimeCount = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;

        this.bufferSize = this.data.blockLength; // 上書き
        let restDataSize = this.data.blockLength - pos; // 残りのデータ
        let buffer = new Buffer(restDataSize);
        let bytes = 0;
        fs.read(fd, buffer, 0, restDataSize, start + pos, (err, bytesRead, buf) => {

            bytes += bytesRead;

            if (bytes === restDataSize) {
                let pos = 0;
                for (let i = 0; i < this.data.observationTimeCount; ++i) {
                    this.data.lineNumber.push(reader.readUInt16(buf.slice(pos, pos + 2)));
                    pos += 2;
                    this.data.observationTime.push(reader.readDouble(buf.slice(pos, pos + 8)));
                    pos += 8;
                }
                resolve(start + this.getBufferSize());
            }
        });
        return false; // block resolve
    }
}

/// #10 エラー情報ブロック
class Header10 extends Block {
    constructor() {
        super(7); // errorCountまで読み込み

        this.data = {
            headerBlockNumber: 7, // 固定
            blockLength: 0, // 変動,
            errorCount: 0,
            lineNumber: [],
            errorPixelPerLine: [],
        };
    }

    parseBuffer(buf, fd, start, resolve) {
        let pos = 0;
        this.data.headerBlockNumber = reader.readUInt8(buf.slice(pos, pos + 1)); // 固定
        pos += 1;
        this.data.blockLength = reader.readUInt32(buf.slice(pos, pos + 4)); // 変動
        pos += 4;
        this.data.errorCount = reader.readUInt16(buf.slice(pos, pos + 2));
        pos += 2;

        this.bufferSize = this.data.blockLength; // 上書き
        let restDataSize = this.data.blockLength - pos; // 残りのデータ
        let buffer = new Buffer(restDataSize);
        let bytes = 0;
        fs.read(fd, buffer, 0, restDataSize, start + pos, (err, bytesRead, buf) => {
            bytes += bytesRead;

            if (bytes === restDataSize) {
                let pos = 0;
                for (let i = 0; i < this.data.errorCount; ++i) {
                    this.data.lineNumber.push(reader.readUInt16(buf.slice(pos, pos + 2)));
                    pos += 2;
                    this.data.errorPixelPerLine.push(reader.readUInt16(buf.slice(pos, pos + 2)));
                    pos += 2;
                }
                resolve(start + this.getBufferSize());
            }
        });
        return false; // block resolve
    }
}

/// #11 予備ブロック
class Header11 extends Block {
    constructor() {
        super(259); // errorCountまで読み込み

        this.data = {
            headerBlockNumber: 11, // 固定
            blockLength: 259, // 固定
        };
    }

    parseBuffer(buf) {
        // nothin to do
    }
}

/// #12 データブロック
class DataBlock extends Block {
    constructor(dataCount) {
        super(dataCount * 2); // 有効ビット数に関わらず2バイトの符号なし整数として記録されている

        this.count = dataCount;

        this.data = []
    }

    parseBuffer(buf) {
        let pos = 0;
        for (let i = 0; i < this.count; ++i, pos += 2) {
            this.data.push(reader.readUInt16(buf.slice(pos, pos + 2)));
        }
    }
}

/// ひまわりのデータ格納用クラス
class HimawariData {
    constructor() {
        this.header1 = new Header1();
        this.header2 = new Header2();
        this.header3 = new Header3();
        this.header4 = new Header4();
        this.header5 = new Header5();
        this.header6 = new Header6();
        this.header7 = new Header7();
        this.header8 = new Header8();
        this.header9 = new Header9();
        this.header10 = new Header10();
        this.header11 = new Header11();
        this.dataBlock = null;
    }
}

/// ひまわりのデータフォーマット用パーサ
/// https://www.data.jma.go.jp/mscweb/ja/info/pdf/HS_D_users_guide_jp_v13.pdf
class HimawariParser {
    constructor() {
        this.himawariData = new HimawariData();
    }

    parse(file) {
        return new Promise((resolve, reject) => {
            fs.open(file, 'r', (err, fd) => {
                if (err) { throw err; }

                let himawari = this.himawariData;
                himawari.header1.parse(fd, 0)
                    .then(currentPos => himawari.header2.parse(fd, currentPos))
                    .then(currentPos => himawari.header3.parse(fd, currentPos))
                    .then(currentPos => himawari.header4.parse(fd, currentPos))
                    .then(currentPos => himawari.header5.parse(fd, currentPos))
                    .then(currentPos => himawari.header6.parse(fd, currentPos))
                    .then(currentPos => himawari.header7.parse(fd, currentPos))
                    .then(currentPos => himawari.header8.parse(fd, currentPos))
                    .then(currentPos => himawari.header9.parse(fd, currentPos))
                    .then(currentPos => himawari.header10.parse(fd, currentPos))
                    .then(currentPos => himawari.header11.parse(fd, currentPos))
                    .then(currentPos => {
                        const dataCount = himawari.header2.data.numberOfColumns * himawari.header2.data.numberOfLines;
                        himawari.dataBlock = new DataBlock(dataCount);
                        return himawari.dataBlock.parse(fd, currentPos);
                    })
                    .then(currentPos => {
                        /*
                        console.log(himawari.header1);
                        console.log(himawari.header2);
                        console.log(himawari.header3);
                        console.log(himawari.header4);
                        console.log(himawari.header5);
                        console.log(himawari.header6);
                        console.log(himawari.header7);
                        console.log(himawari.header8);
                        console.log(himawari.header9);
                        console.log(himawari.header10);
                        console.log(himawari.header11);
                        */
                        console.log("segment number", himawari.header7.data.segmentNumber, "of", himawari.header7.data.totalSegments);
                        console.log("data count:", himawari.header2.data.numberOfColumns, "x", himawari.header2.data.numberOfLines);

                        fs.close(fd, (err) => {
                            if (err) { throw err; }
                            resolve();
                        });
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        });
    }

    getData() {
        return this.himawariData;
    }
}

/// ひまわりのデータの変換用クラス
class HimawariConverter {
    constructor(himawariData) {
        this.himawari = himawariData;
        this.lrad = [];
        this.physicalValue = [];
        this.physicalMinMax = { min: Infinity, max: -Infinity }
    }

    // DN値を放射輝度(lrad)に変換
    convertDataToLrad() {
        const himawari = this.himawari;
        const w = himawari.header2.data.numberOfColumns;
        const h = himawari.header2.data.numberOfLines;
        const dataCount = w * h;
        // 「放射輝度」 =「一次係数」 x 「カウント値」+ 「定数項」
        const gain = himawari.header5.data.gainForCountRadiance;
        const constCountRad = himawari.header5.data.constantForCountRadiance;
        for (let i = 0; i < dataCount; ++i) {
            const dn = himawari.dataBlock.data[i];
            let lrad = Math.max(1.0e-60, gain * dn + constCountRad);
            this.lrad.push(lrad);
        }
    }

    convertLRadToPhysicalValue() {
        const himawari = this.himawari;
        const band = himawari.header5.data.bandNumber;
        let wlen = himawari.header5.data.centralWaveLength;
        if (band > 6) { // バンド7～16
            // 放射輝度を輝度温度に変換
            const c0 = himawari.header5.data.c0;
            const c1 = himawari.header5.data.c1;
            const c2 = himawari.header5.data.c2;
            // const C0 = himawari.header5.data.C0;
            // const C1 = himawari.header5.data.C1;
            // const C2 = himawari.header5.data.C2;
            const c = himawari.header5.data.c;
            const h = himawari.header5.data.h;
            const k = himawari.header5.data.k;

            wlen *= 1.0e-6;
            for (let i = 0; i < this.lrad.length; ++i) {
                let lrad = this.lrad[i];
                lrad *= 1.0e6;
                const t_e = h * c / (k * wlen * Math.log(2 * h * c ** 2 / (wlen ** 5 * lrad) + 1));
                const val = c0 + c1 * t_e + c2 * t_e ** 2;
                this.physicalValue.push(val);
                this.physicalMinMax.min = Math.min(this.physicalMinMax.min, val);
                this.physicalMinMax.max = Math.max(this.physicalMinMax.max, val);
            }
        } else { // バンド1～6
            // 放射輝度を反射率に変換
            const cdash = himawari.header5.data.cdash;
            for (let i = 0; i < this.lrad.length; ++i) {
                let lrad = this.lrad[i];
                const val = cdash * lrad;
                this.physicalValue.push(val);
                this.physicalMinMax.min = Math.min(this.physicalMinMax.min, val);
                this.physicalMinMax.max = Math.max(this.physicalMinMax.max, val);
            }
        }
    }
}

const DEGTORAD = (Math.PI / 180.0);
const RADTODEG = (180.0 / Math.PI);
const SCLUNIT = 1.525878906250000e-05; 	// (= 2^-16)  scaling function 
const NORMAL_END = 0;
const ERROR_END = 100;

// from hisd_pixlin2lonlat.c
HimawariConverter.convertLonLatToPixLin = (himawariData, lon, lat) =>
{
    const header3data = himawariData.header3.data;

    // (1) init
    const invalidPix = -9999.0; // invalid value
    const invalidLin = -9999.0;
    // (2) check latitude
    if (lat < -90.0 || 90.0 < lat) {
        console.error("invalid lat", lat);
        return {
            pix: invalidPix,
            lin: invalidLin
        };
    }
    // (3) check longitude
    while (lon > 180.0) { lon -= 360.0; } // [deg]
    while (lon < -180.0) { lon += 360.0; } // [deg]
    // (4) degree to radian
    lon = lon * DEGTORAD; // [rad]
    lat = lat * DEGTORAD; // [rad]
    // (5) geocentric latitude
    // Global Specification 4.4.3.2
    // phi = arctan( (Rpol^2)/(Req^2) * tan(lat) )
    // 
    // (Rpol^2)/(Req^2) =header3data.Rval12
    const phi = Math.atan(header3data.Rval12 * Math.tan(lat));
    // (6) The length of Re
    // Re = (Rpol) / sqrt( 1 - (Req^2 - Rpol^2) / Req^2 * cos^2(phi) )
    //
    // Rpol = header3data.Rpol
    // (Req^2 - Rpol^2) / Req^2 = header3data.Rval11
    const Re = (header3data.Rpol) /
        Math.sqrt(1 - header3data.Rval11 * Math.cos(phi) * Math.cos(phi));
    // (7) The cartesian components of the vector rs result as follows:
    // r1 = h - Re * cos(phi) * cos(Le-Ld)
    // r2 =    -Re * cos(phi) * sin(Le-Ld)
    // r3 =     Re * sin(phi)
    //
    // Le : longitude
    // Ld : sub_lon = header3data.sub_lon
    // h  : distance from Earth's center to satellite (=header3data.Rs)
    const r1 = header3data.Rs - Re * Math.cos(phi)
        * Math.cos(lon - header3data.sub_lon * DEGTORAD);
    const r2 = - Re * Math.cos(phi)
        * Math.sin(lon - header3data.sub_lon * DEGTORAD);
    const r3 = Re * Math.sin(phi);
    // (8) check seeablibity
    //	double vx = Re * cos(phi) * cos( lon - header3data.sub_lon * DEGTORAD );
    //	if(0 < -r1 * vx - r2 * r2 + r3 * r3){
    //		return(ERROR_END);
    //	}
    if (0 < (r1 * (r1 - header3data.Rs) + (r2 * r2) + (r3 * r3))) {
        return {
            pix: invalidPix,
            lin: invalidLin
        };
    }
    // (9) The projection function is as follows:
    // x  = arctan(-r2/r1)
    // y  = arcsin(r3/rn)
    // rn = sqrt(r1^2 + r2^2 + r3^2)
    const rn = Math.sqrt(r1 * r1 + r2 * r2 + r3 * r3);
    const x = Math.atan2(-r2, r1) * RADTODEG;
    const y = Math.asin(-r3 / rn) * RADTODEG;
    // (10)
    // Global Specification 4.4.4
    // c  = COFF + nint(x * 2^-16 * CFAC)
    // l  = LOFF + nint(y * 2^-16 * LFAC)
    const c = header3data.COFF + x * SCLUNIT * header3data.CFAC;
    const l = header3data.LOFF + y * SCLUNIT * header3data.LFAC;

    return {
        pix: c,
        lin: l
    };
}

// from hisd_pixlin2lonlat.c
HimawariConverter.convertPixLinToLonLat = (himawariData, pix, lin) =>
{
    const header3data = himawariData.header3.data;

    // (0) init
    const invalidLon = -9999.0; // invalid value
    const invalidLat = -9999.0;
    // (1) pix,lin ==> c,l
    const c = pix;
    const l = lin;
    // (2) the intermediate coordinates (x,y)
    // Global Specification 4.4.4 Scaling Function 
    //    c = COFF + nint(x * 2^-16 * CFAC)
    //    l = LOFF + nint(y * 2^-16 * LFAC)
    // The intermediate coordinates (x,y) are as follows :
    //    x = (c -COFF) / (2^-16 * CFAC)
    //    y = (l -LOFF) / (2^-16 * LFAC)
    //    SCLUNIT = 2^-16
    const x = DEGTORAD * (c - header3data.COFF) / (SCLUNIT * header3data.CFAC);
    const y = DEGTORAD * (l - header3data.LOFF) / (SCLUNIT * header3data.LFAC);
    // (3) longtitude,latitude
    // Global Specification 4.4.3.2
    // The invers projection function is as follows : 
    //   lon = arctan(S2/S1) + sub_lon
    //   lat = arctan( (Req^2/Rpol^2) * S3 / Sxy )
    // 
    // Thererin the variables S1,S2,S3,Sxy are as follows :
    //    S1  = Rs - Sn * cos(x) * cos(y)
    //    S2  = Sn * sin(x) * cos(y)
    //    S3  =-Sn * sin(y)
    //    Sxy = sqrt(S1^2 + S2^2)
    //    Sn  =(Rs * cos(x) * cos(y) - Sd ) /
    //         (cos(y) * cos(y) + (Req^2/Rpol^2) * sin(y) * sin(y))
    //    Sd  =sqrt( (Rs * cos(x) * cos(y))^2
    //               - ( cos(y) * cos(y) + (Req^2/Rpol^2) * sin(y) * sin(y) )
    //               * (Rs^2 - Req^2)
    // The variables Rs,Rpol,Req,(Req^2/Rpol^2),(Rs^2 - Req^2) are as follows :
    //    Rs  : distance from Earth center to satellite= header3data.Rs
    //    Rpol: polar radius of the Earth              = header3data.Rpol
    //    Req : equator raidus of the Earth            = header3data.Req
    //    (Req^2/Rpol^2)                               = header3data.Rval13
    //    (Rs^2 - Req^2)                               = header3data.Sd
    let Sd = (header3data.Rs * Math.cos(x) * Math.cos(y)) *
        (header3data.Rs * Math.cos(x) * Math.cos(y)) -
        (Math.cos(y) * Math.cos(y) + header3data.Rval13 * Math.sin(y) * Math.sin(y)) *
        header3data.Sd;
    if (Sd < 0) {
        return {
            lon: invalidLon,
            lat: invalidLat
        }
    } else {
        Sd = Math.sqrt(Sd);
    }
    const Sn = (header3data.Rs * Math.cos(x) * Math.cos(y) - Sd) /
        (Math.cos(y) * Math.cos(y) + header3data.Rval13 * Math.sin(y) * Math.sin(y));
    const S1 = header3data.Rs - (Sn * Math.cos(x) * Math.cos(y));
    const S2 = Sn * Math.sin(x) * Math.cos(y);
    const S3 = -Sn * Math.sin(y);
    const Sxy = Math.sqrt(S1 * S1 + S2 * S2);

    let lon = RADTODEG * Math.atan2(S2, S1) + header3data.sub_lon;
    let lat = RADTODEG * Math.atan(header3data.Rval13 * S3 / Sxy);

    //(4) check longtitude
    while (lon > 180.0) { lon = lon - 360.0; }
    while (lon < -180.0) { lon = lon + 360.0; }

    return {
        lon: lon,
        lat: lat
    }
}

module.exports = {
    HimawariParser: HimawariParser,
    HimawariConverter: HimawariConverter,
};
