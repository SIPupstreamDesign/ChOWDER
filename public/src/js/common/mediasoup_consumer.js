/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import ms from '../../../3rd/js/mediasoup-client.js'
import Command from './command.js'

class MediasoupConsumer {
    constructor(connector, router_id) {
        this.uuid = this.generateUUID();
        console.log("MediasoupProducerUUID",this.uuid);
        this.connector = connector;
        this.router_id = router_id;

        this.device = null;
        this.transport = null;
        this.transportParameters = null;

        this.player = null;
    }

    setPlayer(player){
        this.player = player;
    }

    async handShake(){
        // console.log("[mediasoup_consumer.js]handShake()");
        setTimeout(()=>{

            this.connector.on(Command.MediasoupConsumerRTPCapabilities, async(data) => {
                if(data.uuid !== this.uuid){
                    return;
                }
                // console.log("[mediasoup_consumer.js]Command.MediasoupConsumerRTPCapabilities", data);
                // console.log("router_id",this.router_id);
                await this.handleRtpCapabilities(data.data);
                this.connector.send(Command.MediasoupCreateConsumerTransport, {
                    uuid:this.uuid,
                    router_id:this.router_id
                }, () => {});
            });

            this.connector.on(Command.MediasoupCreateConsumerTransport, async(data) => {
                if(data.uuid !== this.uuid){
                    return;
                }
                // console.log("[mediasoup_consumer.js]Command.MediasoupCreateConsumerTransport", data);
                await this.handleCreateConsumerTransport(data.data);
                // console.log("data.data.producerId",data.data.producerId);
                if(data.data.producerId !== null){
                    this.latestProducer(data.data.producerId);
                }
            });

            this.connector.on(Command.MediasoupConnectConsumerTransport, async(data) => {
                if(data.uuid !== this.uuid){
                    return;
                }
                // console.log("[mediasoup_consumer.js]Command.MediasoupConnectConsumerTransport", data);
                const video = this.player.getVideo();
                if (!this.player.isPlaying()) {
                    video.load();
                    video.play();
                }
            });

            this.connector.on(Command.MediasoupConsumeStream, async(data) => {
                if(data.uuid !== this.uuid){
                    return;
                }
                // console.log("[mediasoup_consumer.js]Command.MediasoupConsumeStream", data);
                this.handleConsumerStreamCreated(data.data);
            });

            this.connector.on(Command.MediasoupNewProducerBroadcast, async(data) => {
                // console.log("[mediasoup_consumer.js]Command.MediasoupNewProducerBroadcast", data);
                // this.handleNewProducer(data.data);
            });

            // 1st
            // console.log("[mediasoup_consumer.js] send MediasoupConsumerRTPCapabilities",this.connector,this.router_id);
            this.connector.send(Command.MediasoupConsumerRTPCapabilities, {
                uuid:this.uuid,
                router_id:this.router_id
            }, () => {});
        },1000);
    }

    async handleRtpCapabilities(rtpCapabilities) {
        console.log('[mediasoup_consumer.js]RTP Capabilities received:', rtpCapabilities);

        this.device = new MediasoupClient.Device();
        await this.device.load({ routerRtpCapabilities: rtpCapabilities })
        console.log('[mediasoup_consumer.js]Device initialized',this.device);
    }

    async handleCreateConsumerTransport(params) {
        // console.log('[mediasoup_consumer.js]Consumer Transport params received:', params);
        // console.log('[mediasoup_consumer.js]handleCreateConsumerTransport: Device',this.device);

        this.transport = this.device.createRecvTransport(params.transportParameters);
        // console.log("[mediasoup_consumer.js]transport",this.transport);
        this.transportParameters = params.transportParameters;

        this.transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            // console.log('dtlsParameters:', dtlsParameters);
            console.log('Connecting consumer transport');
            this.connector.send(Command.MediasoupConnectConsumerTransport, {
                uuid:this.uuid,
                router_id: this.router_id,
                transportId: this.transport.id,
                dtlsParameters: dtlsParameters,
            }, () => {});
    
            callback();
        });

        this.transport.on("connectionstatechange", async(state) => {
            console.log("Transport state:", state);
            if (state === "connected") {
                console.log("transport state connected");
            }
            if (state === "disconnected") {
                console.log("transport state disconnected");
            }
        });
    }

    async handleConsumerStreamCreated(params){
        const { id, producerId, kind, rtpParameters } = params;
        // console.log('handleConsumerStreamCreated',params);
        // console.log('handleConsumerStreamCreated: this.transport',this.transport);

        const consumer = await this.transport.consume({ id, producerId, kind, rtpParameters });
        const stream = new MediaStream([consumer.track]);
        
        this.player.getVideo().srcObject = stream;

    }

    latestProducer(producerId){
        // console.log('[mediasoup_consumer.js]latestProducer:', producerId);
        this.connector.send(Command.MediasoupConsumeStream, {
            uuid:this.uuid,
            router_id: this.router_id,
            transportId: this.transportParameters.id,
            producerId: producerId,
            rtpCapabilities: this.device.rtpCapabilities
        }, () => {});
    }

    // 新しいProducerを処理
    async handleNewProducer(producerData) {
        // console.log('[mediasoup_consumer.js]New producer available:', producerData);

        this.connector.send(Command.MediasoupConsumeStream, {
            uuid:this.uuid,
            router_id: this.router_id,
            transportId: this.transportParameters.id,
            producerId: producerData.producerId,
            rtpCapabilities: this.device.rtpCapabilities
        }, () => {});

    }
    release(){

    }

    generateUUID() {
        return 'xxxxxxxx'.replace(/x/g, ()=>{
            return Math.floor(Math.random() * 16).toString(16);
        });
    }
}

export default MediasoupConsumer;
