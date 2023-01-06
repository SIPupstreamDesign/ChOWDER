/**
 * @classdesc 分割受信したバイナリを合体させる。metabinaryで受信したTileimage想定
 */

class SegmentReceiver{
    constructor(){
        //

        /**
         * ここにバイナリを溜めていく
         * @type {[{id:string,segments:[ArrayBuffer]}]}
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
        // 🐔socketIDを記録してdisconn時の対応
        // console.log("params",params);
        const known = this.puttingKnownID(params,content);

        if(known === false){ // このIdはじめてみた
            console.log(params.id);
            const tmpSeg = [];
            tmpSeg[params.segment_index] = content;
            this.container.push({
                id:params.id,
                segments : tmpSeg
            });
            return null;
        }
        // console.log("container",this.container);
        const complete = this.checkCompleteSegment(params);

        console.log({complete});

        if(complete === true){
            const wholeBuf = this.concatSegment(params.id);
            return wholeBuf;
        }
        return null;
    }

    /**
     * @desc しってるIDならcontainerに蓄積してtrueを返す
     * @param {{id:string,segment_index:number,segment_max:number}} params metadataから抽出したparams
     * @param {ArrayBuffer} content 千切れたbinary
     * @return {boolean} しってるIDかどうか
     */
    puttingKnownID(params,content){
        for(let data of this.container){
            // console.log("@@@@@",data.id,params.id)
            if(data.id === params.id){ // このid知ってる
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
    checkCompleteSegment(params){
        // もしこのセグメント全部コンプリートしてたら
        for(let data of this.container){
            if(data.id === params.id){ // このid知ってる
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
     * @param {string} id
     * @return {Buffer}
     */
    concatSegment(id){
        for(let c of this.container){
            if(id === c.id){
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
     * @param {string} id
     */
    deleteContainer(id){
        for(let i = 0; i < this.container.length ; i++){
            if(id === this.container[i].id){
                this.container.splice(i,1);
            }
        }
    }

}
module.exports = SegmentReceiver;
