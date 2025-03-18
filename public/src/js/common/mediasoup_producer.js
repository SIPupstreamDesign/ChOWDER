/**
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2017-2018 Tokyo University of Science. All rights reserved.
 */

import ms from '../../../3rd/js/mediasoup-client.js'
import Command from './command.js'

class MediasoupProducer {
    constructor(connector, router_id) {
        this.uuid = this.generateUUID();
        console.log("MediasoupProducerUUID",this.uuid);
        this.connector = connector;
        this.router_id = router_id;

        this.device = null;
        this.transport = null;
        this.producer = null;

        this.stream = null;
    }

    setStream(stream){
        this.stream = stream;
    }

    getStream(){
        return this.stream;
    }

    async handShake(){
        // console.log("[mediasoup_producer.js]handshake()");
        this.connector.on(Command.MediasoupProducerRTPCapabilities, async(data) => {
			// console.log("[mediasoup_producer.js]Command.MediasoupProducerRTPCapabilities", data);
            if(data.uuid !== this.uuid){
                return;
            }
			// console.log("router_id",this.router_id);
			await this.handleRtpCapabilities(data.data);
			this.connector.send(Command.MediasoupCreateProducerTransport, {
                uuid:this.uuid,
                router_id:this.router_id
            }, () => {});
		});

        this.connector.on(Command.MediasoupCreateProducerTransport, async(data) => {
            if(data.uuid !== this.uuid){
                return;
            }
			// console.log("[mediasoup_producer.js]Command.MediasoupCreateProducerTransport", data);
            await this.handleCreateProducerTransport(data.data);
        });

        this.connector.on(Command.MediasoupConnectProducerTransport, async(data) => {
            if(data.uuid !== this.uuid){
                return;
            }
            // console.log("[mediasoup_producer.js]Command.MediasoupConnectProducerTransport");

        });

		// 1st
		this.connector.send(Command.MediasoupProducerRTPCapabilities, {
            uuid:this.uuid,
            router_id:this.router_id
        }, () => {});
    }

    async disConnect(){
        // console.log("[mediasoup_producer.js]disConnect");
        this.transport.close();
    }

    async handleRtpCapabilities(rtpCapabilities) {
        // console.log('RTP Capabilities received:', rtpCapabilities);

        this.device = new MediasoupClient.Device();
        await this.device.load({ routerRtpCapabilities: rtpCapabilities })
    }

    // Producer Transportの作成
    // async createTransport() {
    //     this.sendRequest('create-producer-transport', {});
    // }

    async handleCreateProducerTransport(params) {
        // console.log('Producer Transport params received:', params);

        this.transport = this.device.createSendTransport(params.transportParameters);
        // console.log("transport",this.transport);

        this.transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            // console.log('dtlsParameters:', dtlsParameters);
            console.log('Connecting producer transport');
            this.connector.send(Command.MediasoupConnectProducerTransport, {
                uuid:this.uuid,
                router_id: this.router_id,
                transportId: this.transport.id,
                dtlsParameters: dtlsParameters,
            }, () => {});
    
            callback();
        });

        this.transport.on("connectionstatechange", async(state) => {
            console.log("Transport state:", state);
            if (state === "disconnected") {
            }
        });

        this.transport.on('produce', async (parameters, callback) => {
            // console.log("transport.on produce", parameters);
            this.connector.send(Command.MediasoupProduceStream, {
                uuid:this.uuid,
                router_id     : this.router_id,
                transportId   : this.transport.id, 
                kind          : parameters.kind,
                rtpParameters : parameters.rtpParameters,
                appData       : parameters.appData
            }, () => {});
            callback({ id: parameters.id });
        });

        this.transport.on('producedata', async (parameters, callback, errback) => {
            // try {
            //     console.log('Producing data');
            //     this.sendRequest('produce-data', {
            //         transportId: this.transport.id,
            //         produceParameters: parameters,
            //     });
            //     callback({ id: parameters.id });
            // } catch (err) {
            //     errback(err);
            // }
        });

        console.log('Producer transport created');
        this.transport.on('icestatechange', (state) => {
            console.log('ICE state changed:', state);
        });

        this.transport.on('dtlsstatechange', (state) => {
            console.log('DTLS state changed:', state);
        });

        await this.createProducer();

    }

    // DataProducerの作成
    async createProducer() {
        const videoTrack = this.stream.getVideoTracks()[0];
        // console.log("[mediasoup_producer.js]videoTrack.readyState",videoTrack.readyState);
        // console.log("[mediasoup_producer.js]this.transport",this.transport);
        // console.log("transport.connectionState",this.transport.connectionState);
        
        this.transport.produce({ track: videoTrack });
    }

    release(){

    }

    generateUUID() {
        return 'xxxxxxxx'.replace(/x/g, ()=>{
            return Math.floor(Math.random() * 16).toString(16);
        });
    }
}

export default MediasoupProducer;
