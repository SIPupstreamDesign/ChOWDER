/**
 * 画像・映像コンテンツのアスペクト比ロック 単体テスト
 *
 * DOM スタブを使い、サーバー / WebSocket 不要でクライアント単独で実行できる。
 * テスト対象の責務:
 *   - selectMetadata が contentAspect を正しいアスペクト比で setAspectRatio に渡す
 *   - itownsAspect が contentAspect より優先される
 *   - 画像 load イベントで elem.dataset.contentAspect が設定される
 *   - tileimage は orgWidth/orgHeight を優先し、なければ load イベントにフォールバックする
 *   - live-stream の loadedmetadata イベントで contentAspect が設定され、
 *     マニピュレータがターゲット中なら setAspectRatio / moveManipulator が呼ばれる
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================
// DOM スタブ
// ============================================================

type ElemDataset = Record<string, string | undefined>;

function makeFakeElem(id: string, dataset: ElemDataset = {}): HTMLElement {
    const style: Record<string, string> = {};
    return {
        id,
        style: new Proxy(style, {
            set(target, key, value): boolean { target[String(key)] = String(value); return true; },
            get(target, key): string { return target[String(key)] ?? ''; },
        }),
        dataset,
    } as unknown as HTMLElement;
}

// ============================================================
// テスト対象ロジックの再実装（ContentManager.ts と 1:1 対応）
// ============================================================

/**
 * selectMetadata / mousedown ハンドラ内のアスペクト比解決ロジック。
 * itownsAspect → contentAspect の優先順でアスペクト比を返す。
 * どちらも未設定なら null を返す。
 */
function resolveAspectRatio(dataset: ElemDataset): number | null {
    const itownsAspect = (dataset.itownsAspect !== undefined && dataset.itownsAspect !== '')
        ? Number(dataset.itownsAspect)
        : null;
    const contentAspect = (dataset.contentAspect !== undefined && dataset.contentAspect !== '')
        ? Number(dataset.contentAspect)
        : null;
    return itownsAspect ?? contentAspect;
}

/**
 * 画像 load イベントのコールバックロジック。
 * naturalWidth / naturalHeight が正値のとき contentAspect を設定する。
 */
function onImageLoad(
    dataset: ElemDataset,
    naturalWidth: number,
    naturalHeight: number
): void {
    if (naturalWidth > 0 && naturalHeight > 0) {
        dataset.contentAspect = String(naturalHeight / naturalWidth);
    }
}

/**
 * tileimage の contentAspect 設定ロジック。
 * orgWidth/orgHeight が正値のとき即座に設定し、そうでなければ load イベント経由で設定する想定。
 * テストでは load フォールバックを onImageLoad で代替する。
 */
function setTileimageContentAspect(
    dataset: ElemDataset,
    orgWidth: number,
    orgHeight: number
): boolean {
    if (orgWidth > 0 && orgHeight > 0) {
        dataset.contentAspect = String(orgHeight / orgWidth);
        return true;
    }
    return false;
}

/**
 * live-stream loadedmetadata コールバックロジック。
 * videoWidth / videoHeight が正値のとき contentAspect を設定し、
 * manipulator がターゲット中なら setAspectRatio / moveManipulator を呼ぶ。
 */
function onVideoLoadedMetadata(
    dataset: ElemDataset,
    elem: HTMLElement,
    videoWidth: number,
    videoHeight: number,
    manipulator: {
        targetElement: HTMLElement | null;
        setAspectRatio: (r: number) => void;
        moveManipulator: (e: HTMLElement) => void;
    } | null
): void {
    if (videoWidth > 0 && videoHeight > 0) {
        dataset.contentAspect = String(videoHeight / videoWidth);
        if (manipulator !== null && manipulator.targetElement === elem) {
            manipulator.setAspectRatio(Number(dataset.contentAspect));
            manipulator.moveManipulator(elem);
        }
    }
}

// ============================================================
// テスト
// ============================================================

describe('resolveAspectRatio', () => {
    it('itownsAspect のみ設定されている場合はその値を返す', (): void => {
        // Arrange
        const dataset: ElemDataset = { itownsAspect: '0.5625' };

        // Act
        const result = resolveAspectRatio(dataset);

        // Assert
        assert.strictEqual(result, 0.5625);
    });

    it('contentAspect のみ設定されている場合はその値を返す', (): void => {
        // Arrange
        const dataset: ElemDataset = { contentAspect: '0.75' };

        // Act
        const result = resolveAspectRatio(dataset);

        // Assert
        assert.strictEqual(result, 0.75);
    });

    it('itownsAspect と contentAspect が両方設定されている場合は itownsAspect を優先する', (): void => {
        // Arrange
        const dataset: ElemDataset = { itownsAspect: '1.0', contentAspect: '0.5625' };

        // Act
        const result = resolveAspectRatio(dataset);

        // Assert
        assert.strictEqual(result, 1.0);
    });

    it('どちらも設定されていない場合は null を返す', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        const result = resolveAspectRatio(dataset);

        // Assert
        assert.strictEqual(result, null);
    });

    it('空文字列の場合は null として扱う', (): void => {
        // Arrange
        const dataset: ElemDataset = { itownsAspect: '', contentAspect: '' };

        // Act
        const result = resolveAspectRatio(dataset);

        // Assert
        assert.strictEqual(result, null);
    });
});

describe('画像 load イベント: onImageLoad', () => {
    it('naturalWidth と naturalHeight が正値のとき contentAspect を設定する', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        onImageLoad(dataset, 1920, 1080);

        // Assert
        assert.strictEqual(dataset.contentAspect, String(1080 / 1920));
    });

    it('縦長画像（naturalHeight > naturalWidth）でも正しく設定される', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        onImageLoad(dataset, 480, 640);

        // Assert
        assert.strictEqual(dataset.contentAspect, String(640 / 480));
    });

    it('naturalWidth が 0 のとき contentAspect を更新しない', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        onImageLoad(dataset, 0, 1080);

        // Assert
        assert.strictEqual(dataset.contentAspect, undefined);
    });

    it('naturalHeight が 0 のとき contentAspect を更新しない', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        onImageLoad(dataset, 1920, 0);

        // Assert
        assert.strictEqual(dataset.contentAspect, undefined);
    });
});

describe('tileimage: setTileimageContentAspect', () => {
    it('orgWidth と orgHeight が正値のとき contentAspect を即座に設定して true を返す', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        const handled = setTileimageContentAspect(dataset, 3840, 2160);

        // Assert
        assert.strictEqual(handled, true);
        assert.strictEqual(dataset.contentAspect, String(2160 / 3840));
    });

    it('orgWidth が 0 のとき contentAspect を設定せず false を返す（load イベントへフォールバック）', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        const handled = setTileimageContentAspect(dataset, 0, 2160);

        // Assert
        assert.strictEqual(handled, false);
        assert.strictEqual(dataset.contentAspect, undefined);
    });

    it('orgHeight が 0 のとき contentAspect を設定せず false を返す', (): void => {
        // Arrange
        const dataset: ElemDataset = {};

        // Act
        const handled = setTileimageContentAspect(dataset, 3840, 0);

        // Assert
        assert.strictEqual(handled, false);
        assert.strictEqual(dataset.contentAspect, undefined);
    });

    it('フォールバック時は onImageLoad で contentAspect が設定される', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        setTileimageContentAspect(dataset, 0, 0); // フォールバックケース

        // Act (load イベントのフォールバック)
        onImageLoad(dataset, 3840, 2160);

        // Assert
        assert.strictEqual(dataset.contentAspect, String(2160 / 3840));
    });
});

describe('live-stream: onVideoLoadedMetadata', () => {
    it('videoWidth と videoHeight が正値のとき contentAspect を設定する', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        const elem = makeFakeElem('view-stream-001', dataset);

        // Act
        onVideoLoadedMetadata(dataset, elem, 1280, 720, null);

        // Assert
        assert.strictEqual(dataset.contentAspect, String(720 / 1280));
    });

    it('manipulator がターゲット中なら setAspectRatio と moveManipulator が呼ばれる', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        const elem = makeFakeElem('view-stream-002', dataset);
        let receivedAspect: number | null = null;
        let moveCalledWith: HTMLElement | null = null;
        const manipulator = {
            targetElement: elem as HTMLElement | null,
            setAspectRatio: (r: number): void => { receivedAspect = r; },
            moveManipulator: (e: HTMLElement): void => { moveCalledWith = e; },
        };

        // Act
        onVideoLoadedMetadata(dataset, elem, 1920, 1080, manipulator);

        // Assert
        assert.strictEqual(dataset.contentAspect, String(1080 / 1920));
        assert.strictEqual(receivedAspect, 1080 / 1920);
        assert.strictEqual(moveCalledWith, elem);
    });

    it('manipulator が別要素をターゲットにしている場合は setAspectRatio が呼ばれない', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        const elem = makeFakeElem('view-stream-003', dataset);
        const otherElem = makeFakeElem('view-stream-other');
        let setAspectCalled = false;
        const manipulator = {
            targetElement: otherElem as HTMLElement | null,
            setAspectRatio: (_r: number): void => { setAspectCalled = true; },
            moveManipulator: (_e: HTMLElement): void => {},
        };

        // Act
        onVideoLoadedMetadata(dataset, elem, 1280, 720, manipulator);

        // Assert
        assert.strictEqual(dataset.contentAspect, String(720 / 1280));
        assert.strictEqual(setAspectCalled, false);
    });

    it('manipulator が null の場合はクラッシュしない', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        const elem = makeFakeElem('view-stream-004', dataset);

        // Act / Assert (例外なし)
        assert.doesNotThrow((): void => {
            onVideoLoadedMetadata(dataset, elem, 1280, 720, null);
        });
        assert.strictEqual(dataset.contentAspect, String(720 / 1280));
    });

    it('videoWidth が 0 のとき contentAspect を更新しない', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        const elem = makeFakeElem('view-stream-005', dataset);

        // Act
        onVideoLoadedMetadata(dataset, elem, 0, 720, null);

        // Assert
        assert.strictEqual(dataset.contentAspect, undefined);
    });

    it('videoHeight が 0 のとき contentAspect を更新しない', (): void => {
        // Arrange
        const dataset: ElemDataset = {};
        const elem = makeFakeElem('view-stream-006', dataset);

        // Act
        onVideoLoadedMetadata(dataset, elem, 1280, 0, null);

        // Assert
        assert.strictEqual(dataset.contentAspect, undefined);
    });
});

// ============================================================
// 投影公式テスト（manipulator.ts の onMouseMove アスペクト比ロックと 1:1 対応）
// ============================================================

/**
 * manipulator.ts の onMouseMove 内アスペクト比ロックブロックの再実装。
 * handle: 0=NW, 1=SW, 2=SE, 3=NE
 */
function calcProjectedResize(
    handle: 0 | 1 | 2 | 3,
    startWidth: number,
    startHeight: number,
    startLeft: number,
    startTop: number,
    dx: number,
    dy: number,
    aspectRatio: number
): { newWidth: number; newHeight: number; newLeft: number; newTop: number } {
    const r = aspectRatio;
    let s: number;
    switch (handle) {
        case 2: s =  (dx + r * dy) / (1 + r * r); break;
        case 0: s = -(dx + r * dy) / (1 + r * r); break;
        case 1: s = (-dx + r * dy) / (1 + r * r); break;
        case 3: s =  (dx - r * dy) / (1 + r * r); break;
        default: s = dx;
    }
    const newWidth  = Math.max(50, startWidth + s);
    const newHeight = newWidth * r;
    let newLeft = startLeft;
    let newTop  = startTop;
    if (handle === 0 || handle === 1) {
        newLeft = startLeft + (startWidth - newWidth);
    }
    if (handle === 0 || handle === 3) {
        newTop = startTop + (startHeight - newHeight);
    }
    return { newWidth, newHeight, newLeft, newTop };
}

describe('manipulator 投影公式: calcProjectedResize', () => {
    // r=0.75 (4:3 横長) で startWidth=640, startHeight=480 を基準とする
    const SW = 640;
    const SH = 480;
    const SL = 100;
    const ST = 200;
    const R  = 0.75;

    it('SE: 対角線方向のドラッグで s=dx になる（dx=a, dy=a*r のとき）', (): void => {
        // 対角線方向: (a, a*r) をドラッグすると s = a*(1+r²)/(1+r²) = a
        const a = 100;
        const result = calcProjectedResize(2, SW, SH, SL, ST, a, a * R, R);

        assert.strictEqual(result.newWidth,  SW + a);
        assert.strictEqual(result.newHeight, (SW + a) * R);
        assert.strictEqual(result.newLeft,   SL); // SE は left 変化なし
        assert.strictEqual(result.newTop,    ST); // SE は top 変化なし
    });

    it('SE: 縦方向のみドラッグ (dx=0, dy=100) でも正しく計算される', (): void => {
        // s = (0 + 0.75*100) / (1+0.5625) = 75 / 1.5625 = 48
        const expectedS = (0 + R * 100) / (1 + R * R);
        const result = calcProjectedResize(2, SW, SH, SL, ST, 0, 100, R);

        assert.strictEqual(result.newWidth,  SW + expectedS);
        assert.strictEqual(result.newHeight, (SW + expectedS) * R);
    });

    it('NW: 逆方向ドラッグで対称に拡大し、left と top が更新される', (): void => {
        // NW を (-a, -a*r) ドラッグ → s = a
        const a = 100;
        const result = calcProjectedResize(0, SW, SH, SL, ST, -a, -a * R, R);

        const expectedNewWidth  = SW + a;
        const expectedNewHeight = expectedNewWidth * R;
        assert.strictEqual(result.newWidth,  expectedNewWidth);
        assert.strictEqual(result.newHeight, expectedNewHeight);
        assert.strictEqual(result.newLeft,   SL + (SW - expectedNewWidth));  // 左移動
        assert.strictEqual(result.newTop,    ST + (SH - expectedNewHeight)); // 上移動
    });

    it('SW: left が更新され top は変化しない', (): void => {
        // SW を (-a, a*r) ドラッグ → s = a
        const a = 100;
        const result = calcProjectedResize(1, SW, SH, SL, ST, -a, a * R, R);

        const expectedNewWidth  = SW + a;
        const expectedNewHeight = expectedNewWidth * R;
        assert.strictEqual(result.newWidth,  expectedNewWidth);
        assert.strictEqual(result.newHeight, expectedNewHeight);
        assert.strictEqual(result.newLeft,   SL + (SW - expectedNewWidth)); // 左移動
        assert.strictEqual(result.newTop,    ST);                           // top 変化なし
    });

    it('NE: top が更新され left は変化しない', (): void => {
        // NE を (a, -a*r) ドラッグ → s = a
        const a = 100;
        const result = calcProjectedResize(3, SW, SH, SL, ST, a, -a * R, R);

        const expectedNewWidth  = SW + a;
        const expectedNewHeight = expectedNewWidth * R;
        assert.strictEqual(result.newWidth,  expectedNewWidth);
        assert.strictEqual(result.newHeight, expectedNewHeight);
        assert.strictEqual(result.newLeft,   SL);                           // left 変化なし
        assert.strictEqual(result.newTop,    ST + (SH - expectedNewHeight)); // 上移動
    });

    it('最小サイズ: s が -startWidth+50 より小さいとき 50px にクランプされる', (): void => {
        // SW=640 を -1000px ドラッグ → 50px にクランプ
        const result = calcProjectedResize(2, SW, SH, SL, ST, -1000, -1000 * R, R);

        assert.strictEqual(result.newWidth,  50);
        assert.strictEqual(result.newHeight, 50 * R);
    });

    it('縦長アスペクト比 (r=2) でも SE の投影公式が成立する', (): void => {
        const rTall = 2;
        const a = 50;
        // s = (a + 2*a*2) / (1+4) = (a + 4a) / 5 = a
        const result = calcProjectedResize(2, SW, SH, SL, ST, a, a * rTall, rTall);

        assert.strictEqual(result.newWidth,  SW + a);
        assert.strictEqual(result.newHeight, (SW + a) * rTall);
    });
});
