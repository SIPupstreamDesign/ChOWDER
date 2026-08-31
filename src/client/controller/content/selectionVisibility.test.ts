/**
 * コンテンツ選択状態と UI 可視性の単体テスト
 *
 * 検証する挙動:
 *   1. selectMetadata() で content-info-body が表示される
 *   2. resetSelectedMetadata() で content-info-body が非表示になり、
 *      manipulator.removeManipulator() が呼ばれる
 *   3. updateContentsParameter() でテキスト型のとき fixTextWap / fixFontColWap が表示され、
 *      それ以外のとき非表示になる
 *   4. deleteContent() 成功後に resetSelectedMetadata() が呼ばれる（contentInfoBody が非表示）
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ContentManager } from './ContentManager.js';

// ============================================================
// DOM スタブ
// ============================================================

function makeStyle(): Record<string, string> & { display: string } {
    const style: Record<string, string> = { display: '' };
    return new Proxy(style, {
        set(t, k, v) { t[String(k)] = String(v); return true; },
        get(t, k) { return t[String(k)] ?? ''; },
    }) as Record<string, string> & { display: string };
}

function makeDiv(id = '') {
    const style = makeStyle();
    const dataset: Record<string, string> = {};
    const children: any[] = [];
    const classList = {
        _classes: new Set<string>(),
        add(c: string) { this._classes.add(c); },
        remove(c: string) { this._classes.delete(c); },
        toggle(c: string, force?: boolean) {
            if (force === undefined) {
                if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c);
            } else {
                force ? this._classes.add(c) : this._classes.delete(c);
            }
        },
        has(c: string) { return this._classes.has(c); },
    };
    return {
        id,
        style,
        dataset,
        classList,
        children,
        innerHTML: '',
        innerText: '',
        textContent: '',
        disabled: false,
        checked: false,
        value: '',
        appendChild(child: any) { children.push(child); return child; },
        insertBefore(child: any) { children.unshift(child); return child; },
        addEventListener() {},
        removeEventListener() {},
        querySelector(_: string) { return null; },
        querySelectorAll(_: string) { return []; },
        remove() {},
        firstChild: null,
    };
}

// ============================================================
// Manipulator スタブ
// ============================================================

function makeManipulatorSpy() {
    let removeCount = 0;
    let showCount = 0;
    return {
        removeManipulator() { removeCount++; },
        showManipulator() { showCount++ ; },
        init() {},
        setAspectRatio() {},
        isShowManipulator() { return false; },
        get removeCallCount() { return removeCount; },
        get showCallCount() { return showCount; },
    };
}

// ============================================================
// ContentManager deps ファクトリ
// ============================================================

interface TestElements {
    viewArea: any;
    previewContent: any;
    metadataList: any;
    deleteBtn: any;
    contentInfoBody: any;
    fixTextWap: any;
    fixFontColWap: any;
    infoContentType: any;
    posX: any; posY: any; width: any; height: any; zIndex: any;
    contentVisible: any;
    editTextInput: any;
    editContentFontColor: any;
}

function makeElements(): TestElements {
    return {
        viewArea: makeDiv('view-area'),
        previewContent: makeDiv('preview-content'),
        tileUploadOverlay: makeDiv('tile-upload-overlay'),
        metadataList: { innerHTML: '', appendChild() {}, querySelector() { return null; } },
        deleteBtn: { disabled: true },
        contentInfoBody: makeDiv('content-info-body'),
        fixTextWap: makeDiv('fix-text-wap'),
        fixFontColWap: makeDiv('fix-fontcol-wap'),
        infoContentType: { ...makeDiv('info-content-type'), innerText: '' },
        posX: { value: '' }, posY: { value: '' },
        width: { value: '' }, height: { value: '' }, zIndex: { value: '' },
        contentVisible: { checked: true, dataset: { checked: 'true' } },
        editTextInput: { value: '' },
        editContentFontColor: { value: '#ffffff' },
    };
}

function makeDeps(elements: TestElements, manipSpy: ReturnType<typeof makeManipulatorSpy>, overrides?: {
    sendCmdImpl?: (method: string, params: any) => Promise<any>;
    stopVideoResult?: boolean;
    stopLiveStreamResult?: boolean;
}) {
    return {
        elements,
        sendCmd: overrides?.sendCmdImpl ?? (async () => ({})),
        sendBinaryCmd: async () => ({}),
        logFn: () => {},
        manipulator: manipSpy as any,
        getZoom: () => 1,
        pushUpdateStock: () => {},
        getSocketId: () => 'sock1',
        getCurrentUser: () => 'user1',
        getLiveStreamManager: () => null,
        tileUploader: {} as any,
        registerBroadcast: () => {},
        consumePendingProducer: () => null,
        handleNewProducer: async () => {},
        getEditMode: () => 1,
        showRightClickMenu: () => {},
        stopVideoFileByMetadata: async (_id: string): Promise<boolean> => overrides?.stopVideoResult ?? false,
        stopLiveStreamByProducerId: async (_id: string): Promise<boolean> => overrides?.stopLiveStreamResult ?? false,
        addVideoFile: async () => {},
    };
}

// ============================================================
// document スタブ（selectMetadata が renderMetadataList 経由で createElement を呼ぶ）
// ============================================================

let savedDocument: unknown;

function setupDom() {
    savedDocument = (globalThis as any).document;
    (globalThis as any).document = {
        createElement(_tag: string) {
            const style = makeStyle();
            const dataset: Record<string, string> = {};
            const classList = {
                _c: new Set<string>(),
                add(c: string) { this._c.add(c); },
                remove(c: string) { this._c.delete(c); },
                has(c: string) { return this._c.has(c); },
            };
            return {
                style, dataset, classList,
                innerHTML: '',
                addEventListener() {},
                appendChild() {},
            };
        },
        getElementById(_id: string) { return null; },
        body: { appendChild() {} },
    };
}

function teardownDom() {
    (globalThis as any).document = savedDocument;
}

// ============================================================
// テスト
// ============================================================

describe('ContentManager: 選択状態と UI 可視性', () => {

    describe('selectMetadata()', () => {
        beforeEach(() => setupDom());
        afterEach(() => teardownDom());

        it('content-info-body が display:block になる', () => {
            const el = makeElements();
            el.contentInfoBody.style.display = 'none';
            const manip = makeManipulatorSpy();
            const cm = new ContentManager(makeDeps(el, manip));

            (cm as any)._metadataList = [{ metadataId: 'meta-1', type: 'image' }];

            cm.selectMetadata('meta-1');

            assert.strictEqual(el.contentInfoBody.style.display, 'block');
        });

        it('deleteBtn が有効になる', () => {
            const el = makeElements();
            const manip = makeManipulatorSpy();
            const cm = new ContentManager(makeDeps(el, manip));
            (cm as any)._metadataList = [{ metadataId: 'meta-1', type: 'image' }];

            cm.selectMetadata('meta-1');

            assert.strictEqual(el.deleteBtn.disabled, false);
        });
    });

    describe('resetSelectedMetadata()', () => {
        it('content-info-body が display:none になる', () => {
            const el = makeElements();
            el.contentInfoBody.style.display = 'block';
            const manip = makeManipulatorSpy();
            const cm = new ContentManager(makeDeps(el, manip));
            (cm as any)._selectedMetadataId = 'meta-1';

            cm.resetSelectedMetadata();

            assert.strictEqual(el.contentInfoBody.style.display, 'none');
        });

        it('_selectedMetadataId が null になる', () => {
            const el = makeElements();
            const manip = makeManipulatorSpy();
            const cm = new ContentManager(makeDeps(el, manip));
            (cm as any)._selectedMetadataId = 'meta-1';

            cm.resetSelectedMetadata();

            assert.strictEqual((cm as any)._selectedMetadataId, null);
        });

        it('manipulator.removeManipulator() が呼ばれる', () => {
            const el = makeElements();
            const manip = makeManipulatorSpy();
            const cm = new ContentManager(makeDeps(el, manip));

            cm.resetSelectedMetadata();

            assert.strictEqual(manip.removeCallCount, 1);
        });
    });

    describe('updateContentsParameter(): type 別 fixTextWap / fixFontColWap 表示制御', () => {
        function makeContentDom(type: string, text = '', fontColor = '#ffffff'): any {
            const metaBinary = type === 'text' ? JSON.stringify({ value: text, fontColor }) : '';
            return {
                dataset: {
                    worldX: '10', worldY: '20', width: '200', height: '100',
                    visible: 'true', metaBinary,
                },
                style: makeStyle(),
            };
        }

        it('type=text のとき fixTextWap が表示される', () => {
            const el = makeElements();
            el.infoContentType.innerText = 'text';
            el.fixTextWap.style.display = 'none';
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));

            cm.updateContentsParameter(makeContentDom('text', 'hello'));

            assert.strictEqual(el.fixTextWap.style.display, '');
        });

        it('type=text のとき fixFontColWap が表示される', () => {
            const el = makeElements();
            el.infoContentType.innerText = 'text';
            el.fixFontColWap.style.display = 'none';
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));

            cm.updateContentsParameter(makeContentDom('text', 'hello'));

            assert.strictEqual(el.fixFontColWap.style.display, '');
        });

        it('type=image のとき fixTextWap が非表示になる', () => {
            const el = makeElements();
            el.infoContentType.innerText = 'image';
            el.fixTextWap.style.display = '';
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));

            cm.updateContentsParameter(makeContentDom('image'));

            assert.strictEqual(el.fixTextWap.style.display, 'none');
        });

        it('type=image のとき fixFontColWap が非表示になる', () => {
            const el = makeElements();
            el.infoContentType.innerText = 'image';
            el.fixFontColWap.style.display = '';
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));

            cm.updateContentsParameter(makeContentDom('image'));

            assert.strictEqual(el.fixFontColWap.style.display, 'none');
        });

        it('baseElm=null のとき fixTextWap は変化しない（bodyのhide側で制御するため）', () => {
            const el = makeElements();
            el.infoContentType.innerText = 'text';
            el.fixTextWap.style.display = '';
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));

            cm.updateContentsParameter(null);

            assert.strictEqual(el.fixTextWap.style.display, '');
        });
    });

    describe('deleteContent(): 成功後に resetSelectedMetadata が呼ばれる', () => {
        it('sendCmd DeleteContent 成功後に contentInfoBody が非表示になる', async () => {
            const el = makeElements();
            el.contentInfoBody.style.display = 'block';
            const manip = makeManipulatorSpy();
            const cm = new ContentManager(makeDeps(el, manip, {
                sendCmdImpl: async (method: string) => {
                    if (method === 'GetMetaDataList') return { metadataList: [] };
                    return {};
                },
            }));
            (cm as any)._selectedMetadataId = 'meta-1';

            // confirm を自動 OK にする
            const origConfirm = (globalThis as any).confirm;
            (globalThis as any).confirm = () => true;
            try {
                await cm.deleteContent();
            } finally {
                (globalThis as any).confirm = origConfirm;
            }

            assert.strictEqual(el.contentInfoBody.style.display, 'none');
        });
    });

    describe('selectMetadata(): live-stream の Delete ボタン制御', () => {
        beforeEach(() => setupDom());
        afterEach(() => teardownDom());

        it('他ユーザーの live-stream を選択すると deleteBtn が disabled になること', () => {
            // Arrange
            const el = makeElements();
            el.deleteBtn.disabled = false;
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));
            (cm as any)._metadataList = [{
                metadataId: 'stream-1',
                type: 'live-stream',
                socketId: 'other-socket', // getSocketId() が返す 'sock1' と異なる
            }];

            // Act
            cm.selectMetadata('stream-1');

            // Assert
            return assert.strictEqual(el.deleteBtn.disabled, true);
        });

        it('自分の live-stream を選択すると deleteBtn が enabled になること', () => {
            // Arrange
            const el = makeElements();
            el.deleteBtn.disabled = true;
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));
            (cm as any)._metadataList = [{
                metadataId: 'stream-2',
                type: 'live-stream',
                socketId: 'sock1', // getSocketId() と一致
            }];

            // Act
            cm.selectMetadata('stream-2');

            // Assert
            return assert.strictEqual(el.deleteBtn.disabled, false);
        });

        it('live-stream 以外のコンテンツを選択すると deleteBtn が enabled になること', () => {
            // Arrange
            const el = makeElements();
            el.deleteBtn.disabled = true;
            const cm = new ContentManager(makeDeps(el, makeManipulatorSpy()));
            (cm as any)._metadataList = [{ metadataId: 'img-1', type: 'image' }];

            // Act
            cm.selectMetadata('img-1');

            // Assert
            return assert.strictEqual(el.deleteBtn.disabled, false);
        });
    });

    describe('deleteContent(): live-stream の Stop 統合', () => {
        beforeEach(() => setupDom());
        afterEach(() => teardownDom());

        it('自分の live-stream を Delete すると stopLiveStreamByProducerId が呼ばれること', async (): Promise<void> => {
            // Arrange
            const el = makeElements();
            let stopCalledWith: string | null = null;
            const deps = makeDeps(el, makeManipulatorSpy(), {
                sendCmdImpl: async () => ({}),
            });
            deps.stopLiveStreamByProducerId = async (id: string): Promise<boolean> => {
                stopCalledWith = id;
                return true;
            };
            const cm = new ContentManager(deps);
            (cm as any)._selectedMetadataId = 'stream-3';
            (cm as any)._metadataList = [{
                metadataId: 'stream-3',
                type: 'live-stream',
                socketId: 'sock1',
                producerId: 'producer-abc',
            }];

            const origConfirm = (globalThis as any).confirm;
            (globalThis as any).confirm = () => true;
            try {
                await cm.deleteContent();
            } finally {
                (globalThis as any).confirm = origConfirm;
            }

            // Assert
            return assert.strictEqual(stopCalledWith, 'producer-abc', 'stopLiveStreamByProducerId に producerId が渡されること');
        });

        it('stopLiveStreamByProducerId が true を返すとき DeleteContent コマンドは送信されないこと', async (): Promise<void> => {
            // Arrange
            const el = makeElements();
            const sentMethods: string[] = [];
            const deps = makeDeps(el, makeManipulatorSpy(), {
                sendCmdImpl: async (method: string) => {
                    sentMethods.push(method);
                    return {};
                },
                stopLiveStreamResult: true,
            });
            const cm = new ContentManager(deps);
            (cm as any)._selectedMetadataId = 'stream-4';
            (cm as any)._metadataList = [{
                metadataId: 'stream-4',
                type: 'live-stream',
                socketId: 'sock1',
                producerId: 'producer-xyz',
            }];

            const origConfirm = (globalThis as any).confirm;
            (globalThis as any).confirm = () => true;
            try {
                await cm.deleteContent();
            } finally {
                (globalThis as any).confirm = origConfirm;
            }

            // Assert
            return assert.ok(!sentMethods.includes('DeleteContent'), 'DeleteContent が送信されないこと');
        });
    });

});
