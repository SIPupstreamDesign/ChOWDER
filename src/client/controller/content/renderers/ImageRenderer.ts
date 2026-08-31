import { arrayBufferToBase64 } from '../../../metaBinaryClient';
import type { ContentRenderer, RendererContext } from './BaseRenderer';

/**
 * `image` / `tileimage` タイプのコンテンツを img 要素として描画するレンダラー。
 */
export class ImageRenderer implements ContentRenderer {
    canHandle(contentType: string): boolean {
        return contentType === 'image'
            || contentType.startsWith('image/')
            || contentType === 'tileimage';
    }

    mount(elem: HTMLElement, metadata: any, result: any, _ctx: RendererContext): void {
        if (!result.binary) {
            return;
        }

        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.className = 'no-select';

        if (result.type === 'tileimage') {
            this._mountTileimage(img, elem, result);
        } else {
            this._mountImage(img, elem, result);
        }

        elem.appendChild(img);
    }

    private _mountImage(img: HTMLImageElement, elem: HTMLElement, result: any): void {
        const mimeType = result.mime || (result.type?.startsWith('image/') ? result.type : 'image/png');
        const base64 = arrayBufferToBase64(result.binary instanceof ArrayBuffer ? result.binary : result.binary);
        img.src = `data:${mimeType};base64,${base64}`;
        img.addEventListener('load', () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                elem.dataset.contentAspect = String(img.naturalHeight / img.naturalWidth);
            }
        }, { once: true });
    }

    private _mountTileimage(img: HTMLImageElement, elem: HTMLElement, result: any): void {
        const base64 = arrayBufferToBase64(result.binary instanceof ArrayBuffer ? result.binary : result.binary);
        img.src = `data:image/png;base64,${base64}`;
        if ((result as any).orgWidth > 0 && (result as any).orgHeight > 0) {
            elem.dataset.contentAspect = String((result as any).orgHeight / (result as any).orgWidth);
        } else {
            img.addEventListener('load', () => {
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    elem.dataset.contentAspect = String(img.naturalHeight / img.naturalWidth);
                }
            }, { once: true });
        }
    }
}
