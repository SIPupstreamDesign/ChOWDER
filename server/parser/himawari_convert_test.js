

const fs = require('fs');
const path = require('path');

// ひまわりのDATをいろいろ加工してxyzIRGBなtxt形式で出す

//const GeoTIFF = require('./geotiff.js/dist/geotiff.bundle.js');
const HimawariParser = require('./himawari_parser.js').HimawariParser;
const HimawariConverter = require('./himawari_parser.js').HimawariConverter;

function lonLatToPix()
{
    let file = 'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0110.DAT'

    let parser = new HimawariParser();
    parser.parse(file).then(() => {
        const himawari = parser.getData()

        // convertLonLatToPixLin(himawariData, lon, lat)
        let lon = 0; // 緯度
        let lat = 35.39;// 経度
        for (lon = 0; lon < 180; ++lon) {
            let pixlin = HimawariConverter.convertLonLatToPixLin(himawari, lon, lat);
            console.log({
                lon : lon,
                lat : lat
            }, "=>", 
                pixlin
            );

            if (pixlin.pix !== -9999.0 && pixlin.lin !== -9999.0) {
                console.log(
                    "=>", 
                    HimawariConverter.convertPixLinToLonLat(himawari, pixlin.pix, pixlin.lin)
                );
            }
        }
    });
}

function lonLatToXYZ(R, lon, lat)
{
    return {
        x : R * Math.cos(lat) * Math.cos(lon),
        y : R * Math.cos(lat) * Math.sin(lon),
        z : R * Math.sin(lat)
    }
}


const DEGTORAD = (Math.PI / 180.0);
function conterToPLY()
{
    let file = 'H:/data/30/B13/HS_H08_20191010_0930_B13_FLDK_R20_S0310.DAT'

    let parser = new HimawariParser();
    parser.parse(file).then(() => {
        const himawari = parser.getData()

        let converter = new HimawariConverter(himawari);
        converter.convertDataToLrad();
        converter.convertLRadToPhysicalValue();

        let physicalLen = converter.physicalMinMax.max - converter.physicalMinMax.min;

        // convertLonLatToPixLin(himawariData, lon, lat)

        // 前のファイルの中身を消す
        fs.writeFileSync('output.txt', ""); 
        // 追加モードで開きなおす
        let fd = fs.openSync('output.txt', 'a');

        try {
            const w = himawari.header2.data.numberOfColumns;
            const h = himawari.header2.data.numberOfLines;
            console.log(w, h)
            
            let dataStr = "";

            const space = " ";

            const header3data = himawari.header3.data;

            for (let y = 0; y < h; ++y) {
                for (let x = 0; x < w; ++x) {
                    let lonlat = HimawariConverter.convertPixLinToLonLat(himawari, x, y + 550 * 2);
                    if (lonlat.lon !== -9999.0 && lonlat.lat !== -9999.0) 
                    {
                        const pos = y * w + x;
                        if (converter.physicalValue.length > pos) 
                        {
                            const intensity = String((converter.physicalValue[pos] - converter.physicalMinMax.min) / physicalLen);
                            const color = Math.floor(0xFF * intensity);
                            const lon  = lonlat.lon * DEGTORAD;
                            const lat  = lonlat.lat * DEGTORAD;
                            
                            // lon, lat から xyzを出す
                            /*
                            const phi = Math.atan(header3data.Rval12 * Math.tan(lat));
                            const Re = //(header3data.Rpol * 1000) /
                                6500000.0 /
                                Math.sqrt(1 - header3data.Rval11 * Math.cos(phi) * Math.cos(phi));

                            const r1 = header3data.Rs - Re * Math.cos(phi)
                                * Math.cos(lon - header3data.sub_lon * DEGTORAD);
                            const r2 = - Re * Math.cos(phi)
                                * Math.sin(lon - header3data.sub_lon * DEGTORAD);
                            const r3 = Re * Math.sin(phi);
                            */

                            const xyz = lonLatToXYZ(
                                6500000.0,
                                DEGTORAD * lonlat.lon,
                                DEGTORAD * lonlat.lat);
                                
                            dataStr += xyz.x + space 
                                + xyz.y + space 
                                + xyz.z + space 
                                + intensity + space
                                + color + space
                                + color + space
                                + color + space + "\n";
                        }
                    }
                }
                console.log(y);
            }
            
            fs.appendFileSync(fd, dataStr);
        } catch(err) {
            console.error(err);
        } finally {
            if (fd !== undefined) {
                fs.closeSync(fd);
            }
        }
    });
}

conterToPLY();
