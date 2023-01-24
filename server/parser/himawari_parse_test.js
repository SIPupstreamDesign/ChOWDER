// geotiffの書き出しあたりでメモリバカ食いするので
//  node --max-old-space-size=32000 .\himawari_parse_test.js
// という感じでヒープサイズ指定して実行すること.

const fs = require('fs');
const path = require('path');

const GeoTIFF = require('./geotiff.js/dist/geotiff.bundle.js');
const HimawariParser = require('./himawari_parser.js').HimawariParser;
const HimawariConverter = require('./himawari_parser.js').HimawariConverter;

const fileListText = String(fs.readFileSync('himawari_parse_test_file_list.txt'));
const fileList_ = fileListText.split('\n');
let fileList = [];
for (let i = 0; i < fileList_.length; ++i) {
    fileList_[i] = fileList_[i].split('\r').join('');
    if (fileList_[i].length > 0) {
        if (fs.existsSync(fileList_[i])) {
            fileList.push(fileList_[i]);
        } else {
            console.error('Error: Not found file:', fileList_[i]);
        }
    }
}
if (fileList.length > 0) {
    console.log("fileList: ", fileList)
}
if (fileList.length < 10) {
    console.error('Error: Not found 10 paths in file_list.txt');
    console.log('Usage: ');
    console.log(' (1) Please write absolute paths to himawari_parse_test_file_list.txt');
    console.log(' (2) node --max-old-space-size=32000 himawari_parse_test.js');
    process.exit();
}

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
