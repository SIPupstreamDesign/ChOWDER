import { IFrameConnector } from '../../IFrameConnector';
import type { ContentRenderer, RendererContext } from './BaseRenderer';

/**
 * `webgl` タイプのコンテンツを iframe + IFrameConnector で描画するレンダラー。
 *
 * ViewportResize イベントによるローカルのアスペクト比更新のみ行う。
 * サーバーへの同期は行わない（循環更新防止）。
 */
export class WebGLRenderer implements ContentRenderer {
    canHandle(contentType: string): boolean {
        return contentType === 'webgl';
    }

    mount(elem: HTMLElement, metadata: any, result: any, ctx: RendererContext): void {
        if (!result.url) {
            return;
        }

        // itowns コンテンツの初期アスペクト比を metadata から事前設定する
        // （ViewportResize が届く前にマニピュレータを操作してもロックが効く）
        if (metadata.width > 0 && metadata.height > 0) {
            elem.dataset.itownsAspect = String(metadata.height / metadata.width);
        }

        const iframe = document.createElement('iframe');
        iframe.src = result.url;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.pointerEvents = 'none';
        elem.appendChild(iframe);

        iframe.onload = () => {
            try { (iframe.contentWindow as any).chowder_itowns_view_type = 'controller'; } catch (_) {}
            const connector = new IFrameConnector(iframe);
            ctx.webglConnectors.set(metadata.metadataId, { iframe, connector });

            connector.connect(() => {
                if (result.cameraWorldMatrix && result.cameraParams) {
                    this._applyCamera(connector, result);
                } else {
                    connector.send('Resize', { displayMode: true });
                }
            });

            // itowns ビューポートサイズ変更通知はローカルのアスペクト比更新のみ行う。
            // 内側viewport計測値を外枠metadataへ逆流させると循環更新が発生するため、
            // ここではサーバー同期を行わない。
            connector.on('ViewportResize', (_err: unknown, params: { width: number; height: number }) => {
                if (!params || params.width <= 0 || params.height <= 0) {
                    return;
                }
                const aspect = params.height / params.width;
                elem.dataset.itownsAspect = String(aspect);
                if (ctx.manipulator?.targetElement === elem) {
                    ctx.manipulator.setAspectRatio(aspect);
                    ctx.manipulator.moveManipulator(elem);
                }
            });
        };
    }

    private _applyCamera(connector: IFrameConnector, result: any): void {
        try {
            connector.send('UpdateCamera', {
                mat: JSON.parse(result.cameraWorldMatrix),
                params: JSON.parse(result.cameraParams),
            }, () => {
                // カメラ適用後に renderer サイズ・アスペクト比を確定させる
                connector.send('Resize', { displayMode: true });
            });
        } catch (e) {
            console.error('[WebGLRenderer] UpdateCamera parse error:', e);
            connector.send('Resize', { displayMode: true });
        }
    }
}
