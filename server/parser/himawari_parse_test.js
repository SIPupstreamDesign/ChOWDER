// geotiffの書き出しあたりでメモリバカ食いするので
//  node --max-old-space-size=32000 .\himawari_parse_test.js
// という感じでヒープサイズ指定して実行すること.

const fs = require('fs');
const path = require('path');

const GeoTIFF = require('./geotiff.js/dist/geotiff.bundle.js');
const HimawariParser = require('./himawari_parser.js').HimawariParser;
const HimawariConverter = require('./himawari_parser.js').HimawariConverter;

const fileList = [
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0110.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0210.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0310.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0410.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0510.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0610.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0710.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0810.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0910.DAT',
    'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S1010.DAT',
];

function parseAndConvert(fileList, dstConverterList, fileIndex) {
    return new Promise((resolve)  => 
    {
        let file = fileList[fileIndex];
        let parser = new HimawariParser();
        parser.parse(file).then(() => {
            const himawari = parser.getData()
            let converter = new HimawariConverter(himawari);
            converter.convertDataToLrad();
            converter.convertLRadToPhysicalValue();
            
            dstConverterList[fileIndex] = converter;
            resolve();
        });
    });
}

let dstConverterList = [];

Promise.all([
    parseAndConvert(fileList, dstConverterList, 0),
    parseAndConvert(fileList, dstConverterList, 1),
    parseAndConvert(fileList, dstConverterList, 2),
    parseAndConvert(fileList, dstConverterList, 3),
    parseAndConvert(fileList, dstConverterList, 4),
    parseAndConvert(fileList, dstConverterList, 5),
    parseAndConvert(fileList, dstConverterList, 6),
    parseAndConvert(fileList, dstConverterList, 7),
    parseAndConvert(fileList, dstConverterList, 8),
    parseAndConvert(fileList, dstConverterList, 9),
]).then(
    async () => {
        console.log("dstConverterList", dstConverterList.length)
                
        const metadata = {
            width : 5500,
            height : 5500
        }
        let values = [];
        console.log(dstConverterList[0].physicalValue)
        for (let i = 0; i < dstConverterList.length; ++i)
        {
            values = values.concat(dstConverterList[i].physicalValue);
            console.log(i);
        }
        
        const arrayBuffer = await GeoTIFF.writeArrayBuffer(values, metadata);
        fs.writeFileSync("output.tiff", new Buffer(arrayBuffer));

        /*
            // (無理やり)pngとしてファイルに保存
            {
                const w = himawari.header2.data.numberOfColumns;
                const h = himawari.header2.data.numberOfLines;
                const range = Math.abs(converter.physicalMinMax.max - converter.physicalMinMax.min);
                console.log("range", range)
                let canvas = createCanvas(w, h);
                const ctx = canvas.getContext('2d');
                let imageData = ctx.getImageData(0, 0, w, h);
                for (let y = 0; y < h; ++y) {
                    for (let x = 0; x < w; ++x) {
                        const pos = y * w + x;
                        const val = Math.max(Math.min(Math.round(0xFF * converter.physicalValue[pos] / range), 0xFF), 0);
                        imageData.data[pos * 4 + 0] = val;
                        imageData.data[pos * 4 + 1] = val;
                        imageData.data[pos * 4 + 2] = val;
                        imageData.data[pos * 4 + 3] = 0xFF;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                const png = canvas.toBuffer('image/png') 
                fs.writeFileSync("output" + (fileIndex+1) + ".png", png);
            }
        */
    }
);
