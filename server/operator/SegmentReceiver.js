/**
 * @classdesc 分割受信したバイナリを合体させる。metabinaryで受信したTileimage想定
 */

class SegmentReceiver{
    constructor(){
        //

        /**
         * ここにバイナリを溜めていく
         * @type {[{imageID:string,segments:[ArrayBuffer],socketID:string}]}
         */
        this.container = [];
    }

    /**
     * 分割されたtileimageを順次受け取って、全部揃ったら合体したものを返す
     * @function receive
     * @param {{id:string,segment_index:number,segment_max:number}} params metadataから抽出したparams
     * @param {ArrayBuffer} content 千切れたbinary
     * @return {Buffer}
     */
    receive(params,content,socketID){
        console.log("[SegmentReceiver] tileimage segment received",params.id);
        const known = this._putKnownID(params,content);

        if(known === false){ // このIdはじめてみた
            this._putNewID(params,content,socketID);
        }
        // console.log("container",this.container);
        const complete = this._checkCompleteSegment(params);

        if(complete === true){
            const wholeBuf = this._concatSegment(params.id);
            console.log("[SegmentReceiver] tileimage completed",params.id);
            return wholeBuf;
        }
        return null;
    }

    /**
     * 新しいIDをcontainerに入れる
     * @param {{id:string,segment_index:number,segment_max:number}} params metadataから抽出したparams
     * @param {ArrayBuffer} content 千切れたbinary
     */
    _putNewID(params,content,socketID){
        const tmpSeg = [];
        tmpSeg[params.segment_index] = content;
        this.container.push({
            imageID : params.id,
            segments : tmpSeg,
            socketID : socketID
        });
    }

    /**
     * しってるIDならcontainerに蓄積してtrueを返す
     * @param {{id:string,segment_index:number,segment_max:number}} params metadataから抽出したparams
     * @param {ArrayBuffer} content 千切れたbinary
     * @return {boolean} しってるIDかどうか
     */
    _putKnownID(params,content){
        for(let data of this.container){
            // console.log("@@@@@",data.id,params.id)
            if(data.imageID === params.id){ // このid知ってる
                data.segments[params.segment_index] = content;
                return true;
            }
        }
        return false;
    }

    /**
     * @desc conteinerをみて完成してたらtrueを返す
     * @param {{id:string,segment_index:number,segment_max:number}} params metadataから抽出したparams
     * @return {boolean}
     */
    _checkCompleteSegment(params){
        // もしこのセグメント全部コンプリートしてたら
        for(let data of this.container){
            if(data.imageID === params.id){ // このid知ってる
                for(let i = 0 ; i < params.segment_max ; i++){
                    if(data.segments[i] == null){
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
    }

    /**
     * @desc containerの中身をぜんぶくっつける
     * @param {string} imageID
     * @return {Buffer}
     */
    _concatSegment(imageID){
        for(let c of this.container){
            if(imageID === c.imageID){
                let sumLength = 0;
                for(let i = 0; i < c.segments.length; i++){
                    sumLength += c.segments[i].byteLength;
                }

                const whole = new Uint8Array(sumLength);
                let pos = 0;
                for(let i = 0; i < c.segments.length; i++){
                    whole.set(new Uint8Array(c.segments[i]),pos);
                    pos += c.segments[i].byteLength;
                }
                return whole.buffer;
            }
        }
        return null;
    }

    /**
     * @desc idのcontainerの中身を消す
     * @param {string} imageID
     */
    deleteContainerFromImageID(imageID){
        for(let i = 0; i < this.container.length ; i++){
            if(imageID === this.container[i].imageID){
                this.container.splice(i,1);
            }
        }
    }

    /**
     * @desc socketIDのcontainerの中身を消す
     * @param {string} socketID
     */
    deleteContainerFromSocketID(socketID){
        for(let i = 0; i < this.container.length ; i++){
            console.log("now container",this.container[i].socketID);
            if(socketID === this.container[i].socketID){
                this.container.splice(i,1);
            }
        }
    }

}
module.exports = SegmentReceiver;
