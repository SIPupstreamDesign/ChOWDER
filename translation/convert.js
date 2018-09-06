const fs = require('fs')
const csv = require('csv')
const path = require('path')
const iconv = require('iconv-lite');

let config;

try {
    config = JSON.parse(String(fs.readFileSync("./config.json")));
} catch (e) {
    console.error("parse error config.json", e);
}

if (!config.hasOwnProperty('inputDirectory')) {
    console.error("Not found inputDirectory in config.json");
    process.exit(-1);
}
if (!config.hasOwnProperty('outputDirectory')) {
    console.error("Not found outputDirectory in config.json");
    process.exit(-1);
}

fs.readdir(config.inputDirectory, (err, files) => {
    for (let i = 0; i < files.length; ++i) {
        let file = path.join(config.inputDirectory, files[i]);
        let index = 0;
        let result = [];
        console.log("reading.. ", file)

        fs.createReadStream(file)
            .pipe(iconv.decodeStream('SJIS'))
            .pipe(iconv.encodeStream('UTF-8'))
            .pipe(csv.parse())
            .pipe(csv.transform(function(record, callback){
                if (index === 0) {
                    for (let k = 1; k < record.length; ++k) {
                        result.push({
                            lang : record[k],
                            json : {}
                        });
                    }
                } else {
                    for (let k = 0; k < result.length; ++k) {
                        let value = record[k + 1];
                        result[k].json[record[0]] = value;
                    }
                }
                ++index;
            }))
            .on('finish', () => {
                for (let k = 0; k < result.length; ++k) {
                    let outFile =  path.join(config.outputDirectory, result[k].lang + '.json');
                    let outBuffer = JSON.stringify(result[k].json, null, " ");
                    console.log("writting.. ", outFile)
                    fs.writeFileSync(outFile, outBuffer);
                }
                console.log("done")
            });
    }
});


