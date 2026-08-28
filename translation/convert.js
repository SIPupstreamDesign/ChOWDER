/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

 
const fs = require('fs')
const csv = require('csv')
const path = require('path')
const iconv = require('iconv-lite');

const stream = require('stream');
const makeMyStream = function(result) {
  let index = 0;
  return new stream.Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform: function(chunk, encoding, callback) {
        if (index === 0) {
            console.log("start")

            for (let k = 1; k < chunk.length; ++k) {
                result.push({
                    lang : chunk[k],
                    json : {}
                });
            }
        } else {
            for (let k = 0; k < result.length; ++k) {
                let value = chunk[k + 1];
                result[k].json[chunk[0]] = value;
            }
        }
        ++index;
        callback();
    }
  });
};

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
        let result = [];
        console.log("reading.. ", file)

        fs.createReadStream(file)
            .pipe(iconv.decodeStream('SJIS'))
            .pipe(iconv.encodeStream('UTF-8'))
            .pipe(csv.parse())
            .on('error', () => {
                console.log("error")
            })
            .on('end', () => {
                console.log("end")
            })
            .on('close', () => {
                console.log("close")
            })
            .on('finish', () => {
                for (let k = 0; k < result.length; ++k) {
                    let outFile =  path.join(config.outputDirectory, result[k].lang + '.json');
                    let outBuffer = JSON.stringify(result[k].json, null, " ");
                    console.log("writting.. ", outFile)
                    fs.writeFileSync(outFile, outBuffer);
                }
                console.log("done")
            })
            .pipe(makeMyStream(result))
    }
});


