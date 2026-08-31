import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    isContentInWindow,
    virtualToWindowCoordinates,
    calcItownsResizeRect,
    type WindowMetaData,
    type ContentMetadata,
} from './contentCoordinates';

// ============================================================
// テスト用ヘルパー
// ============================================================

function makeWindow(
    posx: number,
    posy: number,
    virtualWidth: number,
    virtualHeight: number,
    pixelWidth = 1920,
    pixelHeight = 1080
): WindowMetaData {
    return {
        id: 'test-window',
        posx,
        posy,
        virtualWidth,
        virtualHeight,
        pixelWidth,
        pixelHeight,
        contentVisible: true,
    };
}

function makeContent(
    posx: number,
    posy: number,
    width: number,
    height: number
): ContentMetadata {
    return {
        metadataId: 'test-content',
        binaryId: '',
        type: 'image',
        posx,
        posy,
        width,
        height,
        zindex: 0,
    };
}

// ============================================================
// isContentInWindow
// ============================================================

describe('isContentInWindow', () => {
    it('windowMetaData が null のとき false を返す', () => {
        const content = makeContent(0, 0, 100, 100);
        assert.strictEqual(isContentInWindow(content, null), false);
    });

    it('コンテンツが完全にウィンドウ内にあるとき true を返す', () => {
        const win = makeWindow(0, 0, 1000, 1000);
        const content = makeContent(100, 100, 200, 200);
        assert.strictEqual(isContentInWindow(content, win), true);
    });

    it('コンテンツが左に完全にはみ出るとき false を返す（contentRight <= posx）', () => {
        // window: x=500 ～ 1500, content: x=0 ～ 500（境界値: contentRight === posx）
        const win = makeWindow(500, 0, 1000, 1000);
        const content = makeContent(0, 100, 500, 200); // right=500, window.posx=500
        assert.strictEqual(isContentInWindow(content, win), false);
    });

    it('コンテンツが右に完全にはみ出るとき false を返す（content.posx >= windowRight）', () => {
        // window: x=0 ～ 1000, content: x=1000 ～ 1200（境界値: content.posx === windowRight）
        const win = makeWindow(0, 0, 1000, 1000);
        const content = makeContent(1000, 100, 200, 200);
        assert.strictEqual(isContentInWindow(content, win), false);
    });

    it('コンテンツが上に完全にはみ出るとき false を返す（contentBottom <= posy）', () => {
        // window: y=500 ～ 1500, content: y=0 ～ 500（境界値: contentBottom === posy）
        const win = makeWindow(0, 500, 1000, 1000);
        const content = makeContent(100, 0, 200, 500);
        assert.strictEqual(isContentInWindow(content, win), false);
    });

    it('コンテンツが下に完全にはみ出るとき false を返す（content.posy >= windowBottom）', () => {
        // window: y=0 ～ 1000, content: y=1000 ～ 1200（境界値: content.posy === windowBottom）
        const win = makeWindow(0, 0, 1000, 1000);
        const content = makeContent(100, 1000, 200, 200);
        assert.strictEqual(isContentInWindow(content, win), false);
    });

    it('コンテンツが左端にかかって部分重複するとき true を返す', () => {
        // window: x=500 ～ 1500, content: x=400 ～ 600（左端に 100px かかる）
        const win = makeWindow(500, 0, 1000, 1000);
        const content = makeContent(400, 100, 200, 200);
        assert.strictEqual(isContentInWindow(content, win), true);
    });

    it('コンテンツが右端にかかって部分重複するとき true を返す', () => {
        // window: x=0 ～ 1000, content: x=900 ～ 1100（右端に 100px かかる）
        const win = makeWindow(0, 0, 1000, 1000);
        const content = makeContent(900, 100, 200, 200);
        assert.strictEqual(isContentInWindow(content, win), true);
    });

    it('コンテンツがウィンドウを完全に包むとき true を返す', () => {
        // content が window より大きく、window 全体を包含
        const win = makeWindow(100, 100, 800, 600);
        const content = makeContent(0, 0, 1920, 1080);
        assert.strictEqual(isContentInWindow(content, win), true);
    });
});

// ============================================================
// virtualToWindowCoordinates
// ============================================================

describe('virtualToWindowCoordinates', () => {
    it('windowMetaData が null のとき {x:0, y:0, w:0, h:0} を返す', () => {
        const result = virtualToWindowCoordinates(100, 200, 300, 400, null);
        assert.deepStrictEqual(result, { x: 0, y: 0, w: 0, h: 0 });
    });

    it('オフセット=0, scale=1 のとき座標がそのまま返る', () => {
        // posx=0, posy=0, virtualWidth=1920, virtualHeight=1080, pixel=1920x1080 → scale=1
        const win = makeWindow(0, 0, 1920, 1080, 1920, 1080);
        const result = virtualToWindowCoordinates(100, 200, 300, 400, win);
        assert.deepStrictEqual(result, { x: 100, y: 200, w: 300, h: 400 });
    });

    it('posx/posy オフセットが引かれて相対座標に変換される', () => {
        // window が virtual 座標 (500, 300) から始まる
        // コンテンツ (600, 400) → relative = (100, 100)
        // scale = 1 (pixel=virtual)
        const win = makeWindow(500, 300, 1920, 1080, 1920, 1080);
        const result = virtualToWindowCoordinates(600, 400, 200, 100, win);
        assert.deepStrictEqual(result, { x: 100, y: 100, w: 200, h: 100 });
    });

    it('pixelWidth/virtualWidth = 2 のとき w が 2 倍になる', () => {
        // pixel=3840x2160, virtual=1920x1080 → scaleX=2, scaleY=2
        const win = makeWindow(0, 0, 1920, 1080, 3840, 2160);
        const result = virtualToWindowCoordinates(0, 0, 100, 50, win);
        assert.deepStrictEqual(result, { x: 0, y: 0, w: 200, h: 100 });
    });

    it('オフセットとスケールが組み合わさっても正しく変換される', () => {
        // window: virtual(500,300), size=1000x500, pixel=2000x1000 → scaleX=2, scaleY=2
        // content at virtual(600, 400) size(100, 80)
        // relative = (100, 100), after scale → x=200, y=200, w=200, h=160
        const win = makeWindow(500, 300, 1000, 500, 2000, 1000);
        const result = virtualToWindowCoordinates(600, 400, 100, 80, win);
        assert.deepStrictEqual(result, { x: 200, y: 200, w: 200, h: 160 });
    });
});

// ============================================================
// calcItownsResizeRect
// ============================================================

describe('calcItownsResizeRect', () => {
    it('コンテンツとウィンドウが一致するとき offset は 0、w/h はピクセルサイズ、contentW/H はコンテンツピクセルサイズ', () => {
        const win = makeWindow(0, 0, 1920, 1080, 1920, 1080);
        const content = makeContent(0, 0, 1920, 1080);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, 0);
        assert.strictEqual(rect.y, 0);
        assert.strictEqual(rect.w, 1920);
        assert.strictEqual(rect.h, 1080);
        assert.strictEqual(rect.contentW, 1920);
        assert.strictEqual(rect.contentH, 1080);
    });

    it('ウィンドウがコンテンツ右下の 1/4 を映すとき正のオフセットになる', () => {
        // ウィンドウ: virtual(1920,1080)、コンテンツ: virtual(0,0)
        // scaleX/Y=1, relX=-1920,relY=-1080 → x=1920, y=1080
        const win = makeWindow(1920, 1080, 1920, 1080, 1920, 1080);
        const content = makeContent(0, 0, 3840, 2160);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, 1920);
        assert.strictEqual(rect.y, 1080);
        assert.strictEqual(rect.w, 1920);
        assert.strictEqual(rect.h, 1080);
        assert.strictEqual(rect.contentW, 3840);
        assert.strictEqual(rect.contentH, 2160);
    });

    it('ウィンドウがコンテンツより左上にはみ出るとき負のオフセットになる', () => {
        // コンテンツ: virtual(500,500)、ウィンドウ: virtual(0,0)
        // scaleX/Y=1, relX=500,relY=500 → x=-500, y=-500
        const win = makeWindow(0, 0, 1920, 1080, 1920, 1080);
        const content = makeContent(500, 500, 1000, 1000);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, -500);
        assert.strictEqual(rect.y, -500);
        assert.strictEqual(rect.w, 1920);
        assert.strictEqual(rect.h, 1080);
        assert.strictEqual(rect.contentW, 1000);
        assert.strictEqual(rect.contentH, 1000);
    });

    it('スケールが 2 倍（pixel が virtual の 2 倍）のときピクセル空間で計算される', () => {
        // ウィンドウ: virtual(1920,1080) 1920x1080、pixel=3840x2160 → scaleX/Y=2
        // relX=-1920,relY=-1080 → contentCoords.x=-3840,y=-2160,w=7680,h=4320
        // x=3840, y=2160, w=3840, h=2160, contentW=7680, contentH=4320
        const win = makeWindow(1920, 1080, 1920, 1080, 3840, 2160);
        const content = makeContent(0, 0, 3840, 2160);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, 3840);
        assert.strictEqual(rect.y, 2160);
        assert.strictEqual(rect.w, 3840);
        assert.strictEqual(rect.h, 2160);
        assert.strictEqual(rect.contentW, 7680);
        assert.strictEqual(rect.contentH, 4320);
    });

    it('scale + offset の複合: ウィンドウが virtual(500,300) から始まり scale=2', () => {
        // virtual: window pos(500,300) size(1000,500), pixel=2000x1000 → scaleX/Y=2
        // content pos(0,0) size(2000,2000)
        // contentCoords.x = (0-500)*2 = -1000 → x=1000
        // contentCoords.y = (0-300)*2 = -600  → y=600
        // contentW = 2000*2 = 4000, contentH = 2000*2 = 4000
        // w=2000, h=1000
        const win = makeWindow(500, 300, 1000, 500, 2000, 1000);
        const content = makeContent(0, 0, 2000, 2000);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, 1000);
        assert.strictEqual(rect.y, 600);
        assert.strictEqual(rect.w, 2000);
        assert.strictEqual(rect.h, 1000);
        assert.strictEqual(rect.contentW, 4000);
        assert.strictEqual(rect.contentH, 4000);
    });

    it('コンテンツがウィンドウより小さい（コンテンツが画面中央に映る）: x/y が負になる', () => {
        // コンテンツ: virtual(960,540) size(480,270) = 画面中央の小さなコンテンツ
        // ウィンドウ: virtual(0,0) size(1920,1080) pixel=1920x1080 → scale=1
        // contentCoords.x = 960, y = 540, w=480, h=270
        // x = -960, y = -540, w=1920, h=1080, contentW=480, contentH=270
        const win = makeWindow(0, 0, 1920, 1080, 1920, 1080);
        const content = makeContent(960, 540, 480, 270);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, -960);
        assert.strictEqual(rect.y, -540);
        assert.strictEqual(rect.w, 1920);
        assert.strictEqual(rect.h, 1080);
        assert.strictEqual(rect.contentW, 480);
        assert.strictEqual(rect.contentH, 270);
    });

    it('コンテンツとウィンドウが部分重複: ウィンドウ右下にコンテンツの一部が映る', () => {
        // コンテンツ: virtual(1600,900) size(640,360)
        // ウィンドウ: virtual(0,0) size(1920,1080) pixel=1920x1080 → scale=1
        // contentCoords.x=1600, y=900, w=640, h=360
        // x=-1600, y=-900, w=1920, h=1080, contentW=640, contentH=360
        const win = makeWindow(0, 0, 1920, 1080, 1920, 1080);
        const content = makeContent(1600, 900, 640, 360);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, -1600);
        assert.strictEqual(rect.y, -900);
        assert.strictEqual(rect.w, 1920);
        assert.strictEqual(rect.h, 1080);
        assert.strictEqual(rect.contentW, 640);
        assert.strictEqual(rect.contentH, 360);
    });

    it('アスペクト比: contentH/contentW が window pixelHeight/pixelWidth と等しいとき setViewOffset のオフセットが 0', () => {
        // ウィンドウとコンテンツが同じ位置にあるとき、アスペクト比に関わらず x=0, y=0
        // win virtualSize=1920x1080, pixel=3840x2160, content at same pos same size
        const win = makeWindow(0, 0, 1920, 1080, 3840, 2160);
        const content = makeContent(0, 0, 1920, 1080);
        const rect = calcItownsResizeRect(content, win);
        assert.strictEqual(rect.x, 0);
        assert.strictEqual(rect.y, 0);
        assert.strictEqual(rect.w, 3840);
        assert.strictEqual(rect.h, 2160);
        assert.strictEqual(rect.contentW, 3840);
        assert.strictEqual(rect.contentH, 2160);
        // アスペクト比が一致していることを確認
        assert.strictEqual(rect.contentW / rect.contentH, rect.w / rect.h);
    });
});

// ============================================================
// 不変条件テスト（回帰テスト）
//
// isContentInWindow と virtualToWindowCoordinates の整合性を保証する:
//   「isContentInWindow が true ならば virtualToWindowCoordinates の結果が
//     ピクセル表示領域 [0,pixelWidth) × [0,pixelHeight) と重なる」
//   「isContentInWindow が false ならば重ならない」
//
// このテストが壊れた場合、コントローラのディスプレイ矩形内にあるコンテンツが
// ディスプレイブラウザで正しく表示されない座標ズレが発生している。
// ============================================================

/** virtualToWindowCoordinates の結果がピクセル表示領域と重なるか判定 */
function pixelRectsOverlap(
    coords: { x: number; y: number; w: number; h: number },
    pixelWidth: number,
    pixelHeight: number
): boolean {
    const contentRight  = coords.x + coords.w;
    const contentBottom = coords.y + coords.h;
    return !(
        contentRight  <= 0          ||
        coords.x      >= pixelWidth  ||
        contentBottom <= 0          ||
        coords.y      >= pixelHeight
    );
}

describe('isContentInWindow と virtualToWindowCoordinates の整合性（回帰テスト）', () => {
    /**
     * isContentInWindow(content, win) === expected と
     * pixelRectsOverlap(virtualToWindowCoordinates(...), ...) === expected が一致することを検証
     */
    function assertConsistency(
        content: ContentMetadata,
        win: WindowMetaData,
        expectedInWindow: boolean,
        label: string
    ): void {
        const inWindow = isContentInWindow(content, win);
        assert.strictEqual(inWindow, expectedInWindow, `isContentInWindow: ${label}`);

        const coords = virtualToWindowCoordinates(content.posx, content.posy, content.width, content.height, win);
        const overlaps = pixelRectsOverlap(coords, win.pixelWidth, win.pixelHeight);
        assert.strictEqual(overlaps, expectedInWindow, `virtualToWindowCoordinates overlap: ${label}`);
    }

    // ---- scale=1, オフセット(0,0) ----

    it('コンテンツが完全にウィンドウ内: isInWindow=true かつ pixel 領域と重なる', () => {
        const win = makeWindow(0, 0, 1920, 1080, 1920, 1080);
        assertConsistency(makeContent(100, 100, 200, 200), win, true, '完全に内側');
    });

    it('コンテンツが完全に左側にはみ出る(境界値): false かつ pixel 領域と重ならない', () => {
        // contentRight(=500) === win.posx(=500) → false
        const win = makeWindow(500, 0, 1000, 1000, 1000, 1000);
        assertConsistency(makeContent(0, 100, 500, 200), win, false, '左に境界値ではみ出る');
    });

    it('コンテンツが完全に右側にはみ出る(境界値): false かつ pixel 領域と重ならない', () => {
        // content.posx(=1000) === windowRight(=1000) → false
        const win = makeWindow(0, 0, 1000, 1000, 1000, 1000);
        assertConsistency(makeContent(1000, 100, 200, 200), win, false, '右に境界値ではみ出る');
    });

    it('コンテンツが完全に上側にはみ出る(境界値): false かつ pixel 領域と重ならない', () => {
        const win = makeWindow(0, 500, 1000, 1000, 1000, 1000);
        assertConsistency(makeContent(100, 0, 200, 500), win, false, '上に境界値ではみ出る');
    });

    it('コンテンツが完全に下側にはみ出る(境界値): false かつ pixel 領域と重ならない', () => {
        const win = makeWindow(0, 0, 1000, 1000, 1000, 1000);
        assertConsistency(makeContent(100, 1000, 200, 200), win, false, '下に境界値ではみ出る');
    });

    // ---- 部分重複ケース ----

    it('コンテンツが左端に 1px かかる: true かつ pixel 領域と重なる', () => {
        const win = makeWindow(500, 0, 1000, 1000, 1000, 1000);
        assertConsistency(makeContent(499, 100, 200, 200), win, true, '左端 1px かかる');
    });

    it('コンテンツが右端に 1px かかる: true かつ pixel 領域と重なる', () => {
        const win = makeWindow(0, 0, 1000, 1000, 1000, 1000);
        assertConsistency(makeContent(999, 100, 200, 200), win, true, '右端 1px かかる');
    });

    it('コンテンツがウィンドウを完全に包む: true かつ pixel 領域と重なる', () => {
        const win = makeWindow(100, 100, 800, 600, 800, 600);
        assertConsistency(makeContent(0, 0, 1920, 1080), win, true, 'コンテンツがウィンドウを包含');
    });

    // ---- オフセットあり (posx=500, posy=300), scale=1 ----

    it('ウィンドウオフセット(500,300): コンテンツが内側', () => {
        const win = makeWindow(500, 300, 1000, 500, 1000, 500);
        assertConsistency(makeContent(600, 400, 100, 100), win, true, 'オフセットあり・内側');
    });

    it('ウィンドウオフセット(500,300): コンテンツが左に完全はみ出し', () => {
        const win = makeWindow(500, 300, 1000, 500, 1000, 500);
        assertConsistency(makeContent(0, 400, 500, 100), win, false, 'オフセットあり・左にはみ出し');
    });

    it('ウィンドウオフセット(500,300): コンテンツが右に完全はみ出し', () => {
        const win = makeWindow(500, 300, 1000, 500, 1000, 500);
        assertConsistency(makeContent(1500, 400, 200, 100), win, false, 'オフセットあり・右にはみ出し');
    });

    // ---- scale=2 (pixel が virtual の 2 倍) ----

    it('scale=2, オフセットなし: コンテンツが内側', () => {
        const win = makeWindow(0, 0, 1920, 1080, 3840, 2160);
        assertConsistency(makeContent(100, 100, 200, 200), win, true, 'scale=2・内側');
    });

    it('scale=2, オフセット(500,300)あり: コンテンツが内側', () => {
        const win = makeWindow(500, 300, 1000, 500, 2000, 1000);
        assertConsistency(makeContent(600, 400, 100, 80), win, true, 'scale=2・オフセットあり・内側');
    });

    it('scale=2, オフセット(500,300)あり: コンテンツが完全にはみ出し', () => {
        const win = makeWindow(500, 300, 1000, 500, 2000, 1000);
        assertConsistency(makeContent(0, 0, 500, 300), win, false, 'scale=2・オフセットあり・はみ出し');
    });

    // ---- 非整数スケール ----

    it('非整数スケール (pixelWidth=1920, virtualWidth=1001): 内側コンテンツの整合性', () => {
        const win = makeWindow(0, 0, 1001, 563, 1920, 1080);
        assertConsistency(makeContent(50, 50, 200, 100), win, true, '非整数スケール・内側');
    });

    it('非整数スケール (pixelWidth=1920, virtualWidth=1001): はみ出しコンテンツの整合性', () => {
        const win = makeWindow(0, 0, 1001, 563, 1920, 1080);
        assertConsistency(makeContent(1001, 50, 200, 100), win, false, '非整数スケール・はみ出し');
    });
});
