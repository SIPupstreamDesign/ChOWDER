import { resizeTextElem } from '../../../common/textUtils';
import type { ContentRenderer, RendererContext } from './BaseRenderer';


/**
 * `pdf` タイプのコンテンツを iframe で描画するレンダラー。
 */
export class PdfRenderer implements ContentRenderer {
    canHandle(contentType: string): boolean {
        return contentType === 'pdf';
    }

    mount(elem: HTMLElement, _metadata: any, result: any, ctx: RendererContext): void {
        if (!result.binary) {
            return;
        }
        const blob = result.binary instanceof Blob
            ? result.binary
            : new Blob([result.binary], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.src = `${blobUrl}#toolbar=0`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        elem.appendChild(iframe);

        const dmyDom = document.createElement('div');
        dmyDom.className = 'no-select';
        dmyDom.style.cssText = ctx.dmyElmStr;
        elem.appendChild(dmyDom);
    }
}

/**
 * `url` タイプのコンテンツを iframe で描画するレンダラー。
 */
export class UrlRenderer implements ContentRenderer {
    canHandle(contentType: string): boolean {
        return contentType === 'url';
    }

    mount(elem: HTMLElement, _metadata: any, result: any, ctx: RendererContext): void {
        const decoder = new TextDecoder();
        let jsonString = decoder.decode(result.binary);
        if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
            jsonString = jsonString.slice(1, -1);
        }
        const jsonObject = JSON.parse(jsonString);
        const iframe = document.createElement('iframe');
        iframe.src = `${jsonObject.value}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        elem.appendChild(iframe);

        const dmyDom = document.createElement('div');
        dmyDom.className = 'no-select';
        dmyDom.style.cssText = ctx.dmyElmStr;
        elem.appendChild(dmyDom);
    }
}

/**
 * `text` タイプのコンテンツを pre 要素で描画するレンダラー。
 * ResizeObserver によるフォントサイズ追従も担当する。
 */
export class TextRenderer implements ContentRenderer {
    private readonly textResizeObservers: Map<string, ResizeObserver>;

    constructor(textResizeObservers: Map<string, ResizeObserver>) {
        this.textResizeObservers = textResizeObservers;
    }

    canHandle(contentType: string): boolean {
        return contentType === 'text';
    }

    mount(elem: HTMLElement, metadata: any, result: any, ctx: RendererContext): void {
        const decoder = new TextDecoder();
        let jsonString = decoder.decode(result.binary);
        if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
            jsonString = jsonString.slice(1, -1);
        }
        const jsonObject = JSON.parse(jsonString);
        elem.dataset.metaBinary = jsonString;

        const preElem = document.createElement('pre');
        preElem.innerHTML = jsonObject.value;
        preElem.style.color = jsonObject.fontColor || 'white';
        preElem.style.margin = '0';
        // 初期フォントサイズをメタデータの height から計算して適用
        resizeTextElem(preElem, metadata.height);
        elem.appendChild(preElem);

        // 矩形リサイズ時にフォントサイズをリアルタイム更新する
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                resizeTextElem(preElem, entry.contentRect.height);
            }
        });
        observer.observe(elem);
        this.textResizeObservers.set(metadata.metadataId, observer);

        const dmyDom = document.createElement('div');
        dmyDom.className = 'no-select';
        dmyDom.style.cssText = ctx.dmyElmStr;
        elem.appendChild(dmyDom);
    }
}
