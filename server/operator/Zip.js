(() => {
    "use strict";
    const fs = require('fs');
    const path = require("path");
    const JSZip = require("jszip");

    class Zip{
        /**
         * extract
         * zipを指定フォルダに解凍する
         * @method extract
         * @param {BLOB} binaryData zip
         * @param {string} extractDir ../public/hoge/ ← ケツスラッシュ
         * @return {Promise<Array<Error,string>>} [{err,dir},{err,dir},{err,dir}]
         */
        static async extract(binaryData, extractDir){
            const zip = new JSZip();
            await zip.loadAsync(binaryData, {base64: false, checkCRC32: true});
            
            let fileList = [];
            for(let i in zip.files){
                const ret = await this._extractFile(zip,i,extractDir).catch((err)=>{
                    // console.log(err);
                    return err;
                });
                fileList.push(ret);
            }
            return fileList;
        }

        /**
         * extractZip から呼ばれる用
         * @method _extractFile
         * @return {Promise} {err,dir}
         */
        static _extractFile(zip,file,extractDir){
            return new Promise((resolve,reject)=>{
                let zipFile = zip.files[file];
                if(zipFile.dir === true){
                    console.log("@@@@@@@@@@@"+extractDir+zipFile.name,fs.existsSync(extractDir+zipFile.name));
                    if(!fs.existsSync(extractDir+zipFile.name)){
                        console.log("[mkdir] : ",extractDir+zipFile.name);
                        fs.mkdir(extractDir+zipFile.name, { recursive: true },(err)=>{
                            if(err){
                                console.log(err)
                                reject({err:err,dir:null});
                            };
                            resolve({err:null,dir:extractDir+zipFile.name});
                        });
                    }else{
                        reject({err:new Error("this filename already exist"),dir:null});
                    }
                }else{
                    if(!fs.existsSync(path.parse(extractDir+zipFile.name).dir)){
                        fs.mkdirSync(path.parse(extractDir+zipFile.name).dir);
                    }
                    zipFile.async("uint8array").then(function (binary) {
                        fs.writeFile(extractDir+zipFile.name,binary,"binary",(err)=>{
                            console.log("[writeFile] : ",extractDir+zipFile.name);
                            if(err){
                                console.log(err)
                                reject({err:err,dir:null});
                            };
                            resolve({err:null,dir:extractDir+zipFile.name});
                        });
                    });
                }
            });
        }
    }

    module.exports = Zip;
})();
