import type { ContentRenderer, RendererContext } from './BaseRenderer';

/**
 * `live-stream` タイプのコンテンツを video 要素で描画するレンダラー。
 *
 * - 自分が送信者でない場合: video 要素を追加し、WebRTC 受信後にサムネイルをキャプチャ。
 * - 自分が送信者の場合: `mountPost` で DOM 追加後にストリームをアタッチ。
 */
export class LiveStreamRenderer implements ContentRenderer {
    canHandle(contentType: string): boolean {
        return contentType === 'live-stream';
    }

    mount(elem: HTMLElement, metadata: any, result: any, ctx: RendererContext): void {
        elem.dataset.publisherSocketId = (result as any).socketId ?? '';
        elem.dataset.producerId = (result as any).producerId ?? '';

        const isOwnVideoFile = (result as any).subtype === 'video-file'
            && result.creatorId === ctx.getCurrentUser();

        if (isOwnVideoFile) {
            // 送信側の video-file は mountPost でビデオ要素をアタッチする
            return;
        }

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';

        // サムネイルキャプチャは handleNewProducer() で stream attachment 完了後に実行する
        // mount() 段階では stream が available ではないため、ここでのキャプチャは失敗する

        video.addEventListener('loadedmetadata', () => {
            if (video.videoWidth <= 0 || video.videoHeight <= 0) {
                return;
            }
            const aspect = video.videoHeight / video.videoWidth;
            elem.dataset.contentAspect = String(aspect);
            const newHeight = Math.round(Number(elem.dataset.width) * aspect);
            elem.style.height = `${newHeight}px`;
            elem.dataset.height = String(newHeight);
            if (ctx.manipulator?.targetElement === elem) {
                ctx.manipulator.setAspectRatio(aspect);
                ctx.manipulator.moveManipulator(elem);
            }
            const metadataId = ctx.getValidMetadataIdFromElem(elem);
            if (metadataId === null) {
                return;
            }
            ctx.pushUpdateStock({
                metadataId,
                binaryId:   elem.dataset.binaryId ?? '',
                type: 'content',
                contentType: elem.dataset.type ?? '',
                posx: Number(elem.dataset.worldX),
                posy: Number(elem.dataset.worldY),
                width: Number(elem.dataset.width),
                height: newHeight,
                visible: elem.dataset.visible !== 'false',
                originWidth:  Number(elem.dataset.originWidth),
                originHeight: Number(elem.dataset.originHeight),
                zindex: Number(elem.style.zIndex),
            });
        }, { once: true });

        elem.appendChild(video);
    }

    mountPost(elem: HTMLElement, metadata: any, result: any, ctx: RendererContext): void {
        const lsm = ctx.getLiveStreamManager();
        if (!lsm) {
            return;
        }

        const isMySession = (result as any).socketId === ctx.getSocketId();
        if (isMySession) {
            this._handleOwnSession(elem, metadata, result, ctx, lsm);
        } else {
            this._handleRemoteSession(elem, metadata, result, ctx, lsm);
        }
    }

    private _handleOwnSession(
        elem: HTMLElement,
        metadata: any,
        result: any,
        ctx: RendererContext,
        lsm: import('../../../liveStreamManager').LiveStreamManager,
    ): void {
        if ((result as any).subtype === 'video-file') {
            this._handleOwnVideoFile(elem, metadata, result, ctx);
        } else {
            const producerId = (result as any).producerId;
            const stream = producerId
                ? lsm.getStreamForProducer(producerId)
                : lsm.localStream;
            if (stream) {
                lsm.attachStreamToElement(elem.id, stream, 'video');
                // stream attachment 完了後にサムネイルをキャプチャ
                const video = elem.querySelector('video');
                if (video) {
                    ctx.captureAndSendLiveStreamThumbnail(metadata.metadataId, video)
                        .catch((err) => console.warn(
                            '[LiveStreamRenderer] Own stream (camera/screen) thumbnail failed:',
                            err
                        ));
                }
            }
        }
    }

    private _handleOwnVideoFile(
        elem: HTMLElement,
        metadata: any,
        result: any,
        ctx: RendererContext,
    ): void {
        const producerId: string | undefined = (result as any).producerId;
        const srcVideo: HTMLVideoElement | null = producerId
            ? ctx.getVideoFilePreviewElement(producerId)
            : null;

        if (srcVideo) {
            srcVideo.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
            elem.insertBefore(srcVideo, elem.firstChild);
            ctx.buildVideoFileOverlay(elem, srcVideo);

            // 送信側: srcVideo はすでに再生中のためすぐにサムネイルを取得できる
            ctx.captureAndSendLiveStreamThumbnail(metadata.metadataId, srcVideo)
                .catch((err) => console.warn('[LiveStreamRenderer] video-file thumbnail failed (sender):', err));

            if (srcVideo.videoWidth > 0 && srcVideo.videoHeight > 0) {
                this._syncVideoAspect(elem, srcVideo.videoWidth, srcVideo.videoHeight, ctx);
            } else {
                srcVideo.addEventListener('loadedmetadata', () => {
                    if (srcVideo.videoWidth > 0 && srcVideo.videoHeight > 0) {
                        this._syncVideoAspect(elem, srcVideo.videoWidth, srcVideo.videoHeight, ctx);
                    }
                }, { once: true });
            }
        } else if (producerId !== undefined) {
            ctx.setPendingVideoFileElemId(elem.id, producerId);
        }
    }

    private _syncVideoAspect(
        elem: HTMLElement,
        videoWidth: number,
        videoHeight: number,
        ctx: RendererContext,
    ): void {
        const aspect = videoHeight / videoWidth;
        elem.dataset.contentAspect = String(aspect);
        const newHeight = Math.round(Number(elem.dataset.width) * aspect);
        elem.style.height = `${newHeight}px`;
        elem.dataset.height = String(newHeight);
        if (ctx.manipulator?.targetElement === elem) {
            ctx.manipulator.setAspectRatio(aspect);
            ctx.manipulator.moveManipulator(elem);
        }
        const metadataId = ctx.getValidMetadataIdFromElem(elem);
        if (metadataId === null) {
            return;
        }
        ctx.pushUpdateStock({
            metadataId,
            binaryId:   elem.dataset.binaryId ?? '',
            type: 'content',
            contentType: elem.dataset.type ?? '',
            posx: Number(elem.dataset.worldX),
            posy: Number(elem.dataset.worldY),
            width: Number(elem.dataset.width),
            height: newHeight,
            visible: elem.dataset.visible !== 'false',
            originWidth:  Number(elem.dataset.originWidth),
            originHeight: Number(elem.dataset.originHeight),
            zindex: Number(elem.style.zIndex),
        });
    }

    private _handleRemoteSession(
        elem: HTMLElement,
        metadata: any,
        _result: any,
        ctx: RendererContext,
        lsm: import('../../../liveStreamManager').LiveStreamManager,
    ): void {
        const producerId = (_result as any).producerId;
        if (!producerId) {
            return;
        }
        const pendingProducer = ctx.consumePendingProducer(producerId);
        if (pendingProducer) {
            // NewProducerAvailable が NewContentAdded より先に届いた場合、
            // pendingStreamProducers に積まれている。取り出したら実際に処理する。
            ctx.handleNewProducer(pendingProducer, metadata).catch((err) =>
                console.warn('[LiveStreamRenderer] handleNewProducer failed for pending producer:', err)
            );
        } else {
            // BulkUpdateMetaData 等で video 要素が再作成された場合、
            // 既に consume 済みのストリームを再アタッチしてサムネイルを再取得する。
            const existingStream = lsm.getStreamForExistingConsumer(producerId);
            if (existingStream) {
                lsm.attachStreamToElement(elem.id, existingStream, 'video');
                const video = elem.querySelector('video');
                if (video) {
                    ctx.captureAndSendLiveStreamThumbnail(metadata.metadataId, video)
                        .catch((err) => console.warn('[LiveStreamRenderer] re-attach thumbnail failed:', err));
                }
            }
        }
    }
}
