/**
 * テキストコンテンツ表示ユーティリティ
 * 旧実装 vscreen_util.js の resizeText に相当するロジックを提供する。
 */

/**
 * テキストのフォントサイズを計算する純粋関数。
 * 旧実装: fsize = parseInt((height - 1) / lineCount)、最小値 9px
 *
 * @param height   表示領域の高さ（px）
 * @param lineCount テキストの行数（0 以下は 1 扱い）
 * @returns 適用するフォントサイズ（px）
 */
export function calcTextFontSize(height: number, lineCount: number): number {
    const lines = Math.max(1, lineCount);
    const size = Math.floor((height - 1) / lines);
    return Math.max(9, size);
}

/**
 * <pre> 要素のフォントサイズを矩形の高さに合わせて計算・適用する。
 * overflow は、計算結果が 9px（最小値）未満のときのみ "auto" に設定し、
 * それ以外は "visible"（旧実装と同様）にする。
 *
 * @param preElem リサイズ対象の <pre> 要素
 * @param height  表示領域の高さ（px）
 */
export function resizeTextElem(preElem: HTMLElement, height: number): void {
    const lineCount = preElem.innerHTML.split('\n').length;
    const fontSize = calcTextFontSize(height, lineCount);
    preElem.style.fontSize = `${fontSize}px`;
    preElem.style.overflow = fontSize <= 9 ? 'auto' : 'visible';
}
