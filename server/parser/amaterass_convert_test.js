// geotiffの書き出しあたりでメモリバカ食いするので
//  node --max-old-space-size=32000 .\himawari_parse_test.js
// という感じでヒープサイズ指定して実行すること.

const fs = require('fs');
const path = require('path');
const ColorInterpolate = require('color-interpolate');

const GeoTIFF = require('./geotiff.js/dist/geotiff.bundle.js');

const AmaterassParser = require('./amaterass_parser.js').AmaterassParser;
const AmaterassConverter = require('./amaterass_parser.js').AmaterassConverter;

function lonLatToXYZ(R, lon, lat) {
    return {
        x: R * Math.cos(lat) * Math.cos(lon),
        y: R * Math.cos(lat) * Math.sin(lon),
        z: R * Math.sin(lat)
    }
}
const DEGTORAD = (Math.PI / 180.0);

const heightFile = 'D:/work/ChOWDER_data/201910110020.wtr.cld.cth.fld.4km.bin'
const thicknessFile = 'D:/work/ChOWDER_data/201910110020.wtr.cld.tau.fld.4km.bin'
const width = 3000;
const height = 3000;

/*
const colormap = ColorInterpolate(["black",
"rgb(0, 0, 255)",
"rgb(0, 255, 255)",
"rgb(0, 255, 0)",
"rgb(255, 255, 0)",
"rgb(255, 0, 0)",
"magenta", "white"])
*/
const colormap = ColorInterpolate(["gray","white"])

function cloudHeightToTXT() {
    // txtとして出力する文字列
    let dataStr = "";

    // 前のファイルの中身を消す
    fs.writeFileSync('output.txt', "");
    // 追加モードで開きなおす
    let fd = fs.openSync('output.txt', 'a');
    const space = " ";

    // 雲頂データ
    let heightParser = new AmaterassParser(width, height);
    heightParser.parse(heightFile).then(
        async () => {
            try {
                let heightValues = heightParser.data;
                let min = Infinity;
                let max = -Infinity;
                for (let i = 0; i < heightValues.length; ++i) {
                    min = Math.min(min, heightValues[i]);
                    max = Math.max(max, heightValues[i]);
                }

                for (let y = 0; y < height; ++y) {
                    for (let x = 0; x < width; ++x) {
                        const lonlat = AmaterassConverter.convertPixelToLonLat(width, height, x, y);
                        const lon = lonlat.lon * DEGTORAD;
                        const lat = lonlat.lat * DEGTORAD;

                        const cloudTopHeight = heightValues[y * width + x];
                        if (cloudTopHeight < 0.1) {
                            continue;
                        }

                        const xyz = lonLatToXYZ(
                            (6378.137 + cloudTopHeight) * 1000,
                            lon,
                            lat);

                        let color = colormap(Math.min(20.0, Math.max(0.0, cloudTopHeight)) / 20.0);
                        color = color.split("rgb(").join("");
                        color = color.split(")").join("");
                        color = color.split(",");

                        dataStr += xyz.x + space
                            + xyz.y + space
                            + xyz.z + space
                            + 255 + space
                            + color[0] + space
                            + color[1] + space
                            + color[2] + space + "\n";
                    }
                }

                fs.appendFileSync(fd, dataStr);
            } catch (err) {
                console.error(err);
            } finally {
                if (fd !== undefined) {
                    fs.closeSync(fd);
                }
            }
        }
    ).catch((err) => {
        console.error(err);
    })
}

// 5100万点
function cloudToTXT()
{

    // 前のファイルの中身を消す
    fs.writeFileSync('output.txt', "");
    // 追加モードで開きなおす
    let fd = fs.openSync('output.txt', 'a');
    const space = " ";

    // 雲頂データ
    let heightParser = new AmaterassParser(width, height);
    heightParser.parse(heightFile).then(async () => {

        // 雲光学的厚さデータ
        let thicknessParser = new AmaterassParser(width, height);
        thicknessParser.parse(thicknessFile).then(async () => {

            let heightValues = heightParser.data;
            let thicknessValues = thicknessParser.data;
            for (let y = 0; y < height; ++y) {
                // txtとして出力する文字列
                let dataStr = "";

                for (let x = 0; x < width; ++x) {
                    const lonlat = AmaterassConverter.convertPixelToLonLat(width, height, x, y);
                    const lon = lonlat.lon * DEGTORAD;
                    const lat = lonlat.lat * DEGTORAD;
                    
                    const cloudTopHeight = heightValues[y * width + x];
                    if (cloudTopHeight < 0.1) {
                        continue;
                    }
                    const cloudThickness = thicknessValues[y * width + x];
                    if (cloudThickness < 0.1) {
                        continue;
                    }

                        
                    let color = colormap(Math.min(20.0, Math.max(0.0, cloudTopHeight)) / 20.0);
                    color = color.split("rgb(").join("");
                    color = color.split(")").join("");
                    color = color.split(",");

                    let offset = 20 / cloudThickness;
                    let minHeight = 0;
                    if (cloudTopHeight < 4) {
                        // 下層雲とみなす
                        minHeight = 1; // 1km
                        let h = (cloudTopHeight - minHeight);
                        if (h > 1) {
                            offset = h / cloudThickness;
                        }
                    }
                    else if (cloudTopHeight < 7.5) {
                        // 中層雲とみなす
                        minHeight = 2; // 2km
                        let h = (cloudTopHeight - minHeight);
                        if (h > 1) {
                            offset = h / cloudThickness;
                        }
                    }
                    else if (cloudTopHeight >= 7.5) {
                        // 上層雲とみなす
                        minHeight = 5; // 5km
                        let h = (cloudTopHeight - minHeight);
                        if (h > 1) {
                            offset = h / cloudThickness;
                        }
                    }

                    let cloudHeight = cloudTopHeight;
                    for (let i = 0; i < cloudThickness; ++i) {
                        if (cloudHeight < 0.1) {
                            break;
                        }
                        const xyz = lonLatToXYZ(
                            (6378.137 + cloudHeight) * 1000,
                            lon,
                            lat);

                        dataStr += xyz.x + space
                            + xyz.y + space
                            + xyz.z + space
                            + 255 + space
                            + color[0] + space
                            + color[1] + space
                            + color[2] + space + "\n";

                        cloudHeight -= offset;
                    }
                    
                }
                fs.appendFileSync(fd, dataStr);
                console.log(y / 3000 * 100 + "%");
            }


        }).catch((err) => {
            console.error(err);
        })
    });

}


// 4億5000万点
function cloudToTXT2()
{
    // 前のファイルの中身を消す
    fs.writeFileSync('D:/work/ChOWDER_data/dist2/output3.txt', "");
    // 追加モードで開きなおす
    let fd = fs.openSync('D:/work/ChOWDER_data/dist2/output3.txt', 'a');
    const space = " ";
    const gridSize = 120 / width;

    // 雲頂データ
    let heightParser = new AmaterassParser(width, height);
    heightParser.parse(heightFile).then(async () => {

        // 雲光学的厚さデータ
        let thicknessParser = new AmaterassParser(width, height);
        thicknessParser.parse(thicknessFile).then(async () => {

            let heightValues = heightParser.data;
            let thicknessValues = thicknessParser.data;
            for (let y = 0; y < height; ++y) {
                // txtとして出力する文字列
                let dataStr = "";

                for (let x = 0; x < width; ++x) {
                    const lonlat = AmaterassConverter.convertPixelToLonLat(width, height, x, y);
                    
                    const cloudTopHeight = heightValues[y * width + x];
                    if (cloudTopHeight < 0.1) {
                        continue;
                    }
                    const cloudThickness = thicknessValues[y * width + x];
                    if (cloudThickness < 0.1) {
                        continue;
                    }

                        
                    let color = colormap(Math.min(20.0, Math.max(0.0, cloudTopHeight)) / 20.0);
                    color = color.split("rgb(").join("");
                    color = color.split(")").join("");
                    color = color.split(",");

                    const nPointsInGrid = 10;

                    let offset = 20 / cloudThickness;
                    let minHeight = 0;
                    if (cloudTopHeight < 4) {
                        // 下層雲とみなす
                        minHeight = 1; // 1km
                        let h = (cloudTopHeight - minHeight);
                        if (h > 1) {
                            offset = h / cloudThickness / 2;
                        }
                    }
                    else if (cloudTopHeight < 7.5) {
                        // 中層雲とみなす
                        minHeight = 2; // 2km
                        let h = (cloudTopHeight - minHeight);
                        if (h > 1) {
                            offset = h / cloudThickness / 2;
                        }
                    }
                    else if (cloudTopHeight >= 7.5) {
                        // 上層雲とみなす
                        minHeight = 5; // 5km
                        let h = (cloudTopHeight - minHeight);
                        if (h > 1) {
                            offset = h / cloudThickness / 2;
                        }
                    }

                    let cloudHeight = cloudTopHeight;
                    for (let i = 0; i < cloudThickness; ++i) {
                        if (cloudHeight < 0.1) {
                            break;
                        }
                        for (let n = 0; n < nPointsInGrid; ++n) {
                            const offsetX = gridSize * Math.random() - (gridSize / 2);
                            const offsetY = gridSize * Math.random() - (gridSize / 2);
                            const lon = (lonlat.lon + offsetY) * DEGTORAD;
                            const lat = (lonlat.lat + offsetX) * DEGTORAD;
                            let ch = (6378.137 + cloudHeight)
                            if (n > 0) {
                                const offsetZ = gridSize * Math.random() - (gridSize / 2);
                                ch = (6378.137 + cloudHeight + offsetZ)
                            }
                            const xyz = lonLatToXYZ(
                                ch * 1000,
                                lon,
                                lat);
    
                            dataStr += xyz.x + space
                                + xyz.y + space
                                + xyz.z + space
                                + 255 + space
                                + color[0] + space
                                + color[1] + space
                                + color[2] + space + "\n";
                        }
                        cloudHeight -= offset;
                    }
                    
                }
                fs.appendFileSync(fd, dataStr);
                console.log(y / 3000 * 100 + "%");
            }


        }).catch((err) => {
            console.error(err);
        })
    });

}


//cloudHeightToTXT();
//cloudToTXT();
cloudToTXT2();