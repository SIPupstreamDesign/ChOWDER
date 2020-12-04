(() => {
    "use strict";
    const fs = require('fs');
    const path = require("path");
    const nodeZip = require("node-zip");

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
            const zip = new nodeZip(binaryData, {base64: false, checkCRC32: true});

            let fileList = [];
            for(let i in zip.files){
                const ret = await this._extractFile(zip,i,extractDir).catch((err)=>{return err;});
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
                if(zip.files[file].options.dir === true){
                    console.log("@@@@@@@@@@@"+extractDir+zip.files[file].name,fs.existsSync(extractDir+zip.files[file].name));
                    if(!fs.existsSync(extractDir+zip.files[file].name)){
                        console.log("[mkdir] : ",extractDir+zip.files[file].name);
                        fs.mkdir(extractDir+zip.files[file].name, { recursive: true },(err)=>{
                            if(err){
                                console.log(err)
                                reject({err:err,dir:null});
                            };
                            resolve({err:null,dir:extractDir+zip.files[file].name});
                        });
                    }else{
                        reject({err:new Error("this filename already exist"),dir:null});
                    }
                }else{
                    if(!fs.existsSync(path.parse(extractDir+zip.files[file].name).dir)){
                        fs.mkdirSync(path.parse(extractDir+zip.files[file].name).dir);
                    }
                    fs.writeFile(extractDir+zip.files[file].name,zip.files[file]._data,"binary",(err)=>{
                        console.log("[writeFile] : ",extractDir+zip.files[file].name);
                        if(err){
                            console.log(err)
                            reject({err:err,dir:null});
                        };
                        resolve({err:null,dir:extractDir+zip.files[file].name});
                    });
                }
            });
        }
    }

    module.exports = Zip;
})();
