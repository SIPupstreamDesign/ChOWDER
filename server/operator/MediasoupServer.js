/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

(() => {
    const mediasoup = require('mediasoup');
    const Command = require('./../command.js');

    class MediasoupServer {
        constructor(){
            this.worker = null;
            this.routers = {};
        }

        async init(){
            this.worker = await mediasoup.createWorker();
        }

        async createRouter(router_id){
            this.routers[router_id] = new MediasoupRouter(router_id, this.worker);
            await this.routers[router_id].startRouter();
        }

        async websocketMessage(command,message){
            if(!message.router_id){
                console.log("[MediasoupServer] router_id not found on message",message)
                return;
            }

            if(!this.routers[message.router_id]){
                console.log("[MediasoupServer] new router_id", message.router_id);
                await this.createRouter(message.router_id);
            }

            return await this.routers[message.router_id].websocketMessage(command,message);
        }

        async disconnect(){

        }
    }

    class MediasoupRouter {
        constructor(router_id, worker) {
            this.router_id = router_id;
            this.consumerList = {};
            this.latestProducer = {
                    transport: null,
                    producer: null
                }

            this.worker = worker;
            this.router = null;

            this.transportOption = {
                listenInfos: [{
                    ip: '0.0.0.0',
                    // announcedIp: '54.248.209.128',
                    announcedIp: '127.0.0.1',
                    portRange: {
                        min: 40000,
                        max: 49999
                    },
                }],
                // listenIps: [{ ip: '0.0.0.0', announcedIp: '54.248.209.128' }], // 適切なIPに変更
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                enableSctp: true,
                initialAvailableOutgoingBitrate: 1000000, // 初期ビットレート
            };

        }

        async startRouter() {
            this.router = await this.worker.createRouter({
                mediaCodecs: [
                    {
                        kind: 'audio',
                        mimeType: 'audio/opus',
                        clockRate: 48000,
                        channels: 2
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters: {}
                    }
                ]
            });
            console.log('[MediasoupServer] router created');
        }

        async _createTransport() {
            const transport = await this.router.createWebRtcTransport(this.transportOption);
            console.log('[MediasoupServer] Transport created:', transport.id);
            transport.observer.on('icestatechange', (state) => {
                console.log('[MediasoupServer] ICE state on server changed:', state);
            });

            transport.observer.on('dtlsstatechange', (state) => {
                console.log('[MediasoupServer] DTLS state on server changed:', state);
            });

            // console.log('[MediasoupServer] Transport created with ICE parameters:', transport.iceParameters);
            // console.log('[MediasoupServer] ICE Candidates:', transport.iceCandidates);

            return transport;

        }

        async websocketMessage(command,data){
            // console.log(`[MediasoupServer] Message received: ${type}`, data);

            // ----- 共通 -----
            if ( command === Command.MediasoupProducerRTPCapabilities|| command === Command.MediasoupConsumerRTPCapabilities) {
                // console.log('[MediasoupServer] Sending RTP Capabilities',this.router.rtpCapabilities);

                return {
                    router_id: this.router_id,
                    type: 'get-rtp-capabilities',
                    data: this.router.rtpCapabilities
                }

            }

            // ----- Producerのリクエスト処理 -----
            else if (command === Command.MediasoupCreateProducerTransport) {
                if(this.latestProducer.transport !== null){
                    this.latestProducer.transport.close();
                }

                console.log('[MediasoupServer] Creating Producer Transport');
                const transport = await this._createTransport();
                const transportParameters = {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                    sctpParameters: transport.sctpParameters,
                }

                transport.observer.on('close', () => {
                    if (transport.producer) {
                        transport.producer.close();
                    }
                    this.latestProducer.transport = null;
                    this.latestProducer.producer = null;
                });
                this.latestProducer.transport = transport;

                return {
                    router_id: this.router_id,
                    data: {transport, transportParameters},
                };
            }

            else if (command === Command.MediasoupConnectProducerTransport) {
                console.log('[MediasoupServer] Connecting Producer Transport');
                const transport = this.latestProducer.transport;
                await transport.connect({ dtlsParameters: data.dtlsParameters });
                console.log('Producer Transport connected');
                return {
                    router_id: this.router_id,
                    data: {},
                };
            }

            // else if (command === 'produce-data') {
            //     console.log('[MediasoupServer] Producing DataChannel');
            //     const transport = this.latestProducer.transport;
            //     // console.log("[MediasoupServer] latestProducer.transport",this.latestProducer.transport)
            //     const dataProducer = await transport.produceData(data.produceParameters);
            //     // console.log("[MediasoupServer] dataProducer",dataProducer)
            //     // console.log("[MediasoupServer] dataProducer.id",dataProducer.id)

            //     // 新しいProducerをブロードキャストでConsumerへ通知
            //     wsServer.connections.forEach((conn) => {
            //         if (conn !== connection) {
            //             conn.sendUTF(
            //                 JSON.stringify({
            //                     router_id: this.router_id,
            //                     type: 'new-producer',
            //                     data: { producerId: dataProducer.id },
            //                 })
            //             );
            //         }
            //     });

            //     return {
            //         router_id: this.router_id,
            //         data: { producerId: dataProducer.id },
            //     };


            //     // this.latestProducer.transport = dataProducer;
            // }

            else if (command === Command.MediasoupProduceStream) {
                // console.log("[MediasoupServer.js],Command.MediasoupProduceStream",this.latestProducer);
                const transport = this.latestProducer.transport;

                const producer = await transport.produce({
                    kind: data.kind,
                    rtpParameters: data.rtpParameters
                });

                this.latestProducer.producer = producer;

                // // 新しいProducerをブロードキャストでConsumerへ通知
                // wsServer.connections.forEach((conn) => {
                //     if (conn !== connection) {
                //         conn.sendUTF(
                //             JSON.stringify({
                //                 router_id: this.router_id,
                //                 type: 'new-producer',
                //                 data: { producerId: producer.id },
                //             })
                //         );
                //     }
                // });

                return {
                    router_id: this.router_id,
                    data: { id: producer.id }
                };

            }

            // ----- Consumerのリクエスト処理 -----
            else if (command === Command.MediasoupCreateConsumerTransport) {
                console.log('[MediasoupServer] Creating Consumer Transport');
                const transport = await this._createTransport();
                const transportParameters = {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                    sctpParameters: transport.sctpParameters,
                }

                transport.observer.on('close', () => {
                    if (transport.consumer) {
                        transport.consumer.close();
                    }
                    delete this.consumerList[transport.id];
                });
                this.consumerList[transport.id] = transport;

                const producerId = (()=>{
                    if(this.latestProducer.producer !== null){
                        return this.latestProducer.producer.id;
                    }else{
                        return null;
                    }
                })();
                // if(this.latestProducer.transport !== null){
                //     producerId = this.latestProducer.producer.id;
                //     // connection.sendUTF(
                //     //     JSON.stringify({
                //     //         router_id: this.router_id,
                //     //         type: 'latest-producer',
                //     //         data: { producerId: this.latestProducer.producer.id},
                //     //     })
                //     // );
                // }

                return {
                    router_id: this.router_id,
                    data: {
                        transport: transport,
                        transportParameters: transportParameters,
                        producerId: producerId
                    },
                };
            }

            else if (command === Command.MediasoupConnectConsumerTransport) {
                console.log('[MediasoupServer] Connecting Consumer Transport');
                const transport = this.consumerList[data.transportId];
                await transport.connect({ dtlsParameters: data.dtlsParameters });
                console.log('[MediasoupServer] Consumer Transport Connected');

                return {
                    router_id: this.router_id,
                    data: {},
                };

            }

            else if (command === 'consume-data') {
                console.log('[MediasoupServer] Consuming Data');
                const transport = this.consumerList[data.transportId];
                const dataConsumer = await transport.consumeData(data.consumeParameters);
                // console.log('[MediasoupServer] Data Consumer created:', dataConsumer);

                dataConsumer.on('message', (msg) => {
                    console.log('[MediasoupServer] DataConsumer received message:', msg);
                });

                const params = {
                    id: dataConsumer.id,
                    dataProducerId: dataConsumer.dataProducerId,
                    sctpStreamParameters: dataConsumer.sctpStreamParameters,
                    label: dataConsumer.label,
                    protocol: dataConsumer.protocol,
                };

                transport.consumer = dataConsumer;

                return {
                    router_id: this.router_id,
                    data: params,
                };
            }

            else if(command === Command.MediasoupConsumeStream){
                console.log("[MediasoupServer.js]Command.MediasoupConsumeStream");
                // console.log("this.latestProducer.transport",this.latestProducer.transport);

                const transport = this.consumerList[data.transportId];

                const consumer = await transport.consume({
                    producerId: data.producerId,
                    rtpCapabilities: data.rtpCapabilities
                });

                // console.log("[MediasoupServer] MediasoupConsumeStream",consumer);

                return {
                    router_id: this.router_id,
                    data: {
                        id: consumer.id,
                        producerId: consumer.producerId,
                        kind: consumer.kind,
                        rtpParameters: consumer.rtpParameters
                    }
                };
            }

            else {
                console.warn(`[MediasoupServer] Unknown message type: ${type}`);
            }
        }
    }

    module.exports = MediasoupServer;
})();
