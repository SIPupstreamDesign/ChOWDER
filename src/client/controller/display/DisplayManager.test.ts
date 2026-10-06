/**
 * calcWindowFrameStyleUpdate のユニットテスト
 *
 * 旧実装のバグ再発を防ぐ:
 *   1. frame.style.height に { width, height } オブジェクトを渡す → "[object Object]px"
 *   2. アスペクト比計算で virtualWidth を 2 回使い virtualHeight が無視される
 *
 * calcWindowFrameStyleUpdate は DOM 非依存の純粋関数なので tsx --test で直接実行可能。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { calcWindowFrameStyleUpdate, DisplayManager } from './DisplayManager';
import { Manipulator } from '../../manipulator';
import { DisplayUpdateQueue } from './displayUpdateBatch';
import type { DisplayUpdateData } from '../types';

class DisplayTestElement {
    readonly style: Record<string, string> = {};
    readonly dataset: Record<string, string> = {};
    readonly children: DisplayTestElement[] = [];
    private readonly classes = new Set<string>();
    private readonly listeners = new Map<string, ((event: MouseEvent) => void)[]>();
    parentElement: DisplayTestElement | null = null;
    id = '';
    textContent = '';
    constructor() {
        Object.defineProperty(this.style, 'setProperty', {
            value: (name: string, value: string): void => { this.style[name] = value; },
        });
    }
    get className(): string { return [...this.classes].join(' '); }
    set className(value: string) { this.classes.clear(); value.split(' ').forEach((name): void => { this.classes.add(name); }); }
    set innerHTML(_value: string) { this.children.splice(0); }
    get offsetWidth(): number { return Number.parseFloat(this.style.width ?? '0'); }
    get offsetHeight(): number { return Number.parseFloat(this.style.height ?? '0'); }
    readonly classList = {
        add: (name: string): void => { this.classes.add(name); },
        remove: (name: string): void => { this.classes.delete(name); },
        contains: (name: string): boolean => { return this.classes.has(name); },
        toggle: (name: string, enabled: boolean): void => { if (enabled) { this.classes.add(name); } else { this.classes.delete(name); } },
    };
    appendChild(child: DisplayTestElement): void { child.parentElement = this; this.children.push(child); }
    removeChild(child: DisplayTestElement): void {
        const index = this.children.indexOf(child);
        if (index < 0) { throw new Error('detached child'); }
        this.children.splice(index, 1);
        child.parentElement = null;
    }
    remove(): void { this.parentElement?.removeChild(this); }
    setAttribute(_name: string, _value: string): void { }
    addEventListener(name: string, listener: (event: MouseEvent) => void): void {
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
    }
    removeEventListener(name: string, listener: (event: MouseEvent) => void): void {
        this.listeners.set(name, (this.listeners.get(name) ?? []).filter((entry): boolean => { return entry !== listener; }));
    }
    fire(name: string, event: Partial<MouseEvent> = {}): void {
        const payload = { button: 0, buttons: 1, clientX: 0, clientY: 0, stopPropagation: (): void => { }, ...event } as MouseEvent;
        [...(this.listeners.get(name) ?? [])].forEach((listener): void => { listener(payload); });
    }
    querySelectorAll(selector: string): DisplayTestElement[] {
        const descendants = this.children.flatMap((child): DisplayTestElement[] => { return [child, ...child.querySelectorAll('*')]; });
        if (selector === '*') { return descendants; }
        if (selector.startsWith('.')) { return descendants.filter((child): boolean => { return child.classes.has(selector.slice(1)); }); }
        const displayId = selector.match(/data-display-id="([^"]+)"/)?.[1];
        return descendants.filter((child): boolean => { return child.dataset.displayId === displayId; });
    }
    querySelector(selector: string): DisplayTestElement | null { return this.querySelectorAll(selector)[0] ?? null; }
}

interface DisplayTestWindow {
    id: string;
    displayId: string;
    displayName: string;
    siteId: string;
    type: string;
    posx: number;
    posy: number;
    virtualWidth: number;
    virtualHeight: number;
    pixelWidth: number;
    pixelHeight: number;
    contentVisible: boolean;
}

async function withDisplayHarness(run: (harness: {
    manager: DisplayManager; manipulator: Manipulator; queue: DisplayUpdateQueue;
    preview: DisplayTestElement; events: DisplayTestElement; sent: DisplayUpdateData[];
    sites: { siteId: string; color: string }[];
    state: {
        site: string; windows: DisplayTestWindow[]; failRead: boolean; saveGate: Promise<void> | null;
        readGate: Promise<void> | null; reads: number; zoom: number; mode: number
    };
}) => Promise<void>): Promise<void> {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const events = new DisplayTestElement();
    Object.defineProperty(globalThis, 'document', {
        configurable: true, value: {
            createElement: (): DisplayTestElement => { return new DisplayTestElement(); },
            body: { style: { cursor: '', userSelect: '' } },
            addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        }
    });
    try {
        const preview = new DisplayTestElement();
        const area = new DisplayTestElement();
        area.appendChild(preview);
        const state = {
            site: 'site', failRead: false, saveGate: null as Promise<void> | null,
            readGate: null as Promise<void> | null, reads: 0, zoom: 1, mode: 2,
            windows: ['a', 'b'].map((id): DisplayTestWindow => {
                return {
                    id: `window-${id}`, displayId: id, displayName: id, siteId: 'site', type: 'display',
                    posx: 0, posy: 0, virtualWidth: 100.75, virtualHeight: 75.5625,
                    pixelWidth: 400, pixelHeight: 300, contentVisible: true
                };
            }),
        };
        const sent: DisplayUpdateData[] = [];
        const sites: { siteId: string; color: string }[] = [];
        const manipulator = new Manipulator();
        const queue = new DisplayUpdateQueue(async (data): Promise<void> => {
            sent.push(data);
            if (state.saveGate !== null) { await state.saveGate; }
            state.windows = state.windows.map((window): DisplayTestWindow => {
                if (window.id !== data.windowId) { return window; }
                return {
                    ...window, posx: data.posx ?? window.posx, posy: data.posy ?? window.posy,
                    virtualWidth: data.virtualWidth ?? window.virtualWidth,
                    virtualHeight: data.virtualWidth !== undefined ? data.virtualWidth * 0.75 : window.virtualHeight
                };
            });
        });
        const manager = new DisplayManager({
            elements: {
                viewArea: area, previewDisplay: preview, approvedDisplays: new DisplayTestElement(),
                siteInDisplayList: new DisplayTestElement(), pendingDisplays: new DisplayTestElement(),
                waitApprovalWap: new DisplayTestElement(), toggleVdaAttach: { checked: false }
            },
            sendCmd: async (method): Promise<unknown> => {
                if (state.failRead) { throw new Error('read failed'); }
                if (method === 'GetWindowMetaData') {
                    state.reads++;
                    const windows = state.windows.map((window): DisplayTestWindow => { return { ...window }; });
                    if (state.readGate !== null) { await state.readGate; }
                    return windows;
                }
                if (method === 'GetDisplaysBySite') { return { displayIds: state.windows.map((window): string => { return window.displayId; }) }; }
                return {
                    displays: state.windows.map((window): { displayId: string; windowId: string; displayName: string } => {
                        return { displayId: window.displayId, windowId: window.id, displayName: window.displayName };
                    })
                };
            },
            logFn: (): void => { }, adminPendingBadge: null, manipulator, updateQueue: queue,
            getSites: (): unknown[] => { return sites; }, getZoom: (): number => { return state.zoom; },
            pushUpdateStock: (): void => { },
            setVisiblePendingList: (): void => { },
            buildSiteSelect: (): HTMLSelectElement => { return new DisplayTestElement() as unknown as HTMLSelectElement; },
            renderSiteGrid: (): void => { },
            getCurrentSiteId: (): string => { return state.site; }, getEditMode: (): number => { return state.mode; },
            renderAllSiteGrid: (): void => { }, getIsAdmin: (): boolean => { return false; },
        });
        await manager.refreshDisplays();
        await run({ manager, manipulator, queue, preview, events, sent, state, sites });
        manager.cancelInteraction();
    } finally {
        if (descriptor !== undefined) { Object.defineProperty(globalThis, 'document', descriptor); }
        else { Reflect.deleteProperty(globalThis, 'document'); }
    }
}

async function drainDisplayUntil(check: () => boolean): Promise<void> {
    for (let turn = 0; turn < 100 && !check(); turn++) { await Promise.resolve(); }
    assert.equal(check(), true, 'operation must settle without a timer');
}

describe('DisplayManager selected display interactions', (): void => {
    it('uses the frame site color for the selected fill and restores it after redraw', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, state, sites }): Promise<void> => {
            assert.equal(preview.children[0].style['--display-frame-color'], undefined);
            sites.push({ siteId: 'site', color: '#339977' });
            await manager.refreshDisplays();
            const first = preview.children[0];
            manager.selectDisplay('a', state.windows[0]);
            assert.equal(first.style['--display-frame-color'], '#339977');
            assert.equal(first.style.borderColor, '#339977');
            assert.equal(first.classList.contains('selected'), true);
            await manager.refreshDisplays();
            assert.notEqual(preview.children[0], first);
            assert.equal(preview.children[0].style['--display-frame-color'], '#339977');
            assert.equal(preview.children[0].classList.contains('selected'), true);
            manager.selectDisplay('b', state.windows[1]);
            assert.equal(preview.children[0].classList.contains('selected'), false);
            assert.equal(preview.children[1].classList.contains('selected'), true);
        });
    });
    it('preserves selection when filtering the same site again', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, manipulator, preview, state }): Promise<void> => {
            manager.selectDisplay('a', state.windows[0]);
            manager.filterApprovedDisplaysByIds(['a', 'b']);
            await manager.refreshDisplays();
            assert.equal(manager.selectedDisplayId, 'a');
            assert.equal(preview.children[0].classList.contains('selected'), true);
            assert.equal(manipulator.targetElement, preview.children[0]);
        });
    });
    it('discards the old context and coalesces repeated refresh requests', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, state }): Promise<void> => {
            manager.selectDisplay('a', state.windows[0]);
            let release: () => void = (): void => { };
            state.readGate = new Promise<void>((resolve): void => { release = resolve; });
            const first = manager.refreshDisplays();
            state.site = 'new-site';
            state.windows[0].siteId = 'new-site';
            const second = manager.refreshDisplays();
            const third = manager.refreshDisplays();
            release();
            await Promise.all([first, second, third]);
            assert.equal(state.reads, 3);
            assert.equal(manager.selectedDisplayId, null);
            assert.equal(preview.children[0].style.display, 'block');
            assert.equal(preview.children[1].style.display, 'none');
        });
    });

    it('cancels an external hide immediately without waiting for redraw', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, manipulator, preview, events, sent, state }): Promise<void> => {
            preview.children[0].fire('mousedown');
            events.fire('mousemove', { clientX: 10 });
            state.windows[0].contentVisible = false;
            manager.updateWindowFrameByMetaData({ id: 'window-a', displayId: 'a', contentVisible: false });
            assert.equal(manager.isInteracting, false);
            assert.equal(manipulator.targetElement, null);
            await drainDisplayUntil((): boolean => { return manager.isWindowEditable('window-a'); });
            assert.equal(sent.length, 0);
            assert.equal(manager.selectedDisplayId, 'a');
            assert.equal(preview.children[0].style.display, 'none');
        });
    });

    it('waits for the in-flight save before reading back a cancelled movement', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, events, sent, state, queue }): Promise<void> => {
            let release: () => void = (): void => { };
            state.saveGate = new Promise<void>((resolve): void => { release = resolve; });
            preview.children[0].fire('mousedown');
            events.fire('mousemove', { clientX: 10 });
            queue.flush();
            await Promise.resolve();
            assert.equal(sent.length, 1);
            const reads = state.reads;
            manager.cancelInteraction();
            await Promise.resolve();
            assert.equal(state.reads, reads);
            assert.equal(manager.isWindowEditable('window-a'), false);
            release();
            await drainDisplayUntil((): boolean => { return manager.isWindowEditable('window-a'); });
            assert.equal(preview.children[0].dataset.worldX, '10');
        });
    });

    it('finishes a minimum-size no-op without saving and clears selection on mode switch', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, manipulator, preview, sent, state }): Promise<void> => {
            state.windows[0].virtualWidth = 50;
            state.windows[0].virtualHeight = 37.5;
            await manager.refreshDisplays();
            manager.selectDisplay('a', state.windows[0]);
            manipulator.beginResize(preview.children[0] as unknown as HTMLElement, 2,
                { button: 0, clientX: 0, clientY: 0 } as MouseEvent);
            manipulator.onMouseMove({ buttons: 1, clientX: -10, clientY: -10 } as MouseEvent);
            manipulator.onMouseUp();
            assert.equal(sent.length, 0);
            assert.equal(manager.isWindowEditable('window-a'), true);
            state.mode = 1;
            await manager.refreshDisplays();
            assert.equal(manager.selectedDisplayId, null);
            assert.equal(manipulator.targetElement, null);
        });
    });
    it('switches the selected frame and restores handles on the replacement DOM', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, manipulator, preview, state }): Promise<void> => {
            const first = preview.children[0];
            const second = preview.children[1];
            manager.selectDisplay('a', state.windows[0]);
            assert.equal(first.classList.contains('selected'), true);
            assert.equal(manipulator.targetElement, first);
            manager.selectDisplay('b', state.windows[1]);
            assert.equal(first.classList.contains('selected'), false);
            assert.equal(second.classList.contains('selected'), true);
            await manager.refreshDisplays();
            assert.notEqual(preview.children[1], second);
            assert.equal(preview.children[1].classList.contains('selected'), true);
            assert.equal(manipulator.targetElement, preview.children[1]);
            manager.selectDisplay(null, null);
            assert.equal(manipulator.targetElement, null);
            assert.equal(preview.children[1].classList.contains('selected'), false);
        });
    });

    it('treats movement below four CSS pixels as selection only at any zoom', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, events, sent, state }): Promise<void> => {
            state.zoom = 2;
            const frame = preview.children[0];
            frame.fire('mousedown');
            events.fire('mousemove', { clientX: 3 });
            events.fire('mouseup');
            assert.equal(sent.length, 0);
            assert.equal(manager.isWindowEditable('window-a'), true);
            assert.equal(frame.dataset.worldX, '0');
            frame.fire('mousedown');
            events.fire('mousemove', { clientX: 4 });
            events.fire('mouseup');
            await drainDisplayUntil((): boolean => { return manager.isWindowEditable('window-a'); });
            assert.equal(sent.length, 1);
            assert.equal(sent[0].posx, 2);
        });
    });

    it('holds the frame and blocks editing until the final save and fresh read complete', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, events, sent, state }): Promise<void> => {
            let release: () => void = (): void => { };
            state.saveGate = new Promise<void>((resolve): void => { release = resolve; });
            const frame = preview.children[0];
            frame.fire('mousedown');
            events.fire('mousemove', { clientX: 8 });
            events.fire('mouseup');
            await Promise.resolve();
            assert.equal(sent.length, 1);
            assert.equal(manager.isWindowEditable('window-a'), false);
            await manager.refreshDisplays();
            assert.equal(preview.children[0], frame);
            release();
            await drainDisplayUntil((): boolean => { return manager.isWindowEditable('window-a'); });
            assert.notEqual(preview.children[0], frame);
            assert.equal(preview.children[0].dataset.worldX, '8');
            assert.equal(manager.selectedDisplayId, 'a');
        });
    });

    it('saves position with a fractional NW resize from list selection', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, manipulator, preview, sent, state }): Promise<void> => {
            manager.selectDisplay('a', state.windows[0]);
            const frame = preview.children[0];
            manipulator.beginResize(frame as unknown as HTMLElement, 0, { button: 0, clientX: 0, clientY: 0 } as MouseEvent);
            manipulator.onMouseMove({ buttons: 1, clientX: 20, clientY: 15 } as MouseEvent);
            manipulator.onMouseUp();
            await drainDisplayUntil((): boolean => { return manager.isWindowEditable('window-a'); });
            assert.equal(sent.length, 1);
            assert.equal(sent[0].posx, 20);
            assert.equal(sent[0].posy, 15);
            assert.equal(sent[0].virtualWidth, 80.75);
            assert.equal(state.windows[0].posx + state.windows[0].virtualWidth, 100.75);
            assert.equal(state.windows[0].posy + state.windows[0].virtualHeight, 75.5625);
        });
    });

    it('cancels unsent movement without saving and resynchronizes the old local position', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, events, sent }): Promise<void> => {
            const frame = preview.children[0];
            frame.fire('mousedown');
            events.fire('mousemove', { clientX: 10 });
            assert.equal(frame.dataset.worldX, '10');
            manager.cancelInteraction();
            events.fire('mouseup');
            await drainDisplayUntil((): boolean => { return manager.isWindowEditable('window-a'); });
            assert.equal(sent.length, 0);
            assert.equal(preview.children[0].dataset.worldX, '0');
        });
    });

    it('disables invalid-ratio and hidden handles without clearing the hidden selection', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, manipulator, preview, state }): Promise<void> => {
            state.windows[0].pixelWidth = 0;
            await manager.refreshDisplays();
            manager.selectDisplay('a', state.windows[0]);
            assert.equal(preview.children[0].classList.contains('selected'), true);
            assert.equal(manipulator.targetElement, null);
            state.windows[0].pixelWidth = 400;
            state.windows[0].contentVisible = false;
            await manager.refreshDisplays();
            assert.equal(manager.selectedDisplayId, 'a');
            assert.equal(manipulator.targetElement, null);
            state.windows[0].contentVisible = true;
            await manager.refreshDisplays();
            assert.equal(manipulator.targetElement, preview.children[0]);
        });
    });

    it('keeps failed resynchronization locked and retries once on re-selection', { timeout: 5000 }, async (): Promise<void> => {
        await withDisplayHarness(async ({ manager, preview, state }): Promise<void> => {
            manager.selectDisplay('a', state.windows[0]);
            const frame = preview.children[0];
            state.failRead = true;
            manager.handleUpdateFailure('window-a', new Error('save failed'));
            await manager.refreshDisplays();
            assert.equal(manager.isWindowEditable('window-a'), false);
            assert.equal(preview.children[0], frame);
            state.failRead = false;
            manager.selectDisplay('a', state.windows[0]);
            await manager.refreshDisplays();
            assert.equal(manager.isWindowEditable('window-a'), true);
        });
    });
});

// ============================================================
// style.width / style.height
// ============================================================

describe('calcWindowFrameStyleUpdate — width / height', () => {
    it('virtualWidth/Height がそのまま width/height に返る', () => {
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 960,
            virtualHeight: 540,
        });
        assert.equal(result.width, 960);
        assert.equal(result.height, 540);
    });

    it('virtualWidth と virtualHeight が異なる場合でも height は virtualHeight を使う', () => {
        // 旧バグ: newHeight = virtualWidth * (virtualWidth / pixelWidth) で virtualHeight を無視していた
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 1920,
            virtualHeight: 800,   // ← 16:9 ではない意図的な高さ
            pixelWidth: 3840,
            pixelHeight: 1600,
        });
        assert.equal(result.height, 800, 'height は virtualHeight そのまま');
    });

    it('width/height は number 型である（文字列やオブジェクトでない）', () => {
        // 旧バグ: `${newWH}` → "[object Object]" になっていた
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 1920,
            virtualHeight: 1080,
            pixelWidth: 3840,
            pixelHeight: 2160,
        });
        assert.equal(typeof result.width, 'number');
        assert.equal(typeof result.height, 'number');
    });

    it('virtualWidth/Height が未指定なら width/height は null', () => {
        const result = calcWindowFrameStyleUpdate({
            pixelWidth: 1920,
            pixelHeight: 1080,
        });
        assert.equal(result.width, null);
        assert.equal(result.height, null);
    });

    it('virtualWidth のみ（virtualHeight なし）なら width/height どちらも null', () => {
        const result = calcWindowFrameStyleUpdate({
            virtualWidth: 1920,
        });
        assert.equal(result.width, null);
        assert.equal(result.height, null);
    });
});

// ============================================================
// dataset.pixelWidth / pixelHeight
// ============================================================

describe('calcWindowFrameStyleUpdate — pixelWidth / pixelHeight', () => {
    it('pixelWidth/Height は仮想寸法とは別に返る', () => {
        const result = calcWindowFrameStyleUpdate({
            pixelWidth: 3840,
            pixelHeight: 2160,
        });
        assert.equal(result.pixelWidth, 3840);
        assert.equal(result.pixelHeight, 2160);
    });

    it('pixelWidth/Height が未指定なら null', () => {
        const result = calcWindowFrameStyleUpdate({ virtualWidth: 960, virtualHeight: 540 });
        assert.equal(result.pixelWidth, null);
        assert.equal(result.pixelHeight, null);
    });
});

// ============================================================
// style.left / style.top / dataset.worldX / worldY
// ============================================================

describe('calcWindowFrameStyleUpdate — position', () => {
    it('posx/posy が left/top/worldX/worldY に返る', () => {
        const result = calcWindowFrameStyleUpdate({ posx: 100, posy: 200 });
        assert.equal(result.left, 100);
        assert.equal(result.top, 200);
        assert.equal(result.worldX, 100);
        assert.equal(result.worldY, 200);
    });

    it('posx のみ（posy なし）なら left/top は null', () => {
        const result = calcWindowFrameStyleUpdate({ posx: 100 });
        assert.equal(result.left, null);
        assert.equal(result.top, null);
    });

    it('posx/posy が 0 のときも正しく返る（falsy 値の誤判定がない）', () => {
        const result = calcWindowFrameStyleUpdate({ posx: 0, posy: 0 });
        assert.equal(result.left, 0);
        assert.equal(result.top, 0);
        assert.equal(result.worldX, 0);
        assert.equal(result.worldY, 0);
    });
});

// ============================================================
// 複合ケース（典型的な UpdateWindowMetaData ペイロード）
// ============================================================

describe('calcWindowFrameStyleUpdate — 複合ケース', () => {
    it('全フィールドが揃っている場合に全値が返る', () => {
        const result = calcWindowFrameStyleUpdate({
            posx: 960,
            posy: 0,
            virtualWidth: 960,
            virtualHeight: 540,
            pixelWidth: 1920,
            pixelHeight: 1080,
        });
        assert.equal(result.left, 960);
        assert.equal(result.top, 0);
        assert.equal(result.width, 960);
        assert.equal(result.height, 540);
        assert.equal(result.pixelWidth, 1920);
        assert.equal(result.pixelHeight, 1080);
    });

    it('ディスプレイを横に2面並べた右側ウィンドウ: y=0 のまま維持される', () => {
        // 旧バグでは style.height が "[object Object]px" になり
        // コントローラ上の矩形高さが崩れて y 座標ズレに見えた
        const result = calcWindowFrameStyleUpdate({
            posx: 1920,
            posy: 0,
            virtualWidth: 1920,
            virtualHeight: 1080,
            pixelWidth: 1920,
            pixelHeight: 1080,
        });
        assert.equal(result.height, 1080, 'height は virtualHeight = 1080 であること');
        assert.equal(result.top, 0, 'top は posy = 0 であること');
    });
});

// ============================================================
// deleteSelectedDisplay
// ============================================================

describe('DisplayManager.deleteSelectedDisplay', () => {
    const originalConfirm = globalThis.confirm;

    const createManager = (): DisplayManager => {
        const elements = {
            approvedDisplays: null,
            previewDisplay: null,
            siteInDisplayList: null,
            viewArea: null,
            waitApprovalWap: { style: { display: '' } },
            toggleDisplayVisible: { checked: true, dataset: { checked: 'true' } },
        };

        return new DisplayManager({
            elements,
            updateQueue: new DisplayUpdateQueue(async (): Promise<void> => { }),
            sendCmd: async (): Promise<any> => {
                return {};
            },
            logFn: (): void => { },
            adminPendingBadge: null,
            manipulator: null,
            getSites: (): any[] => {
                return [];
            },
            getZoom: (): number => {
                return 1;
            },
            pushUpdateStock: (): void => { },
            setVisiblePendingList: (): void => { },
            buildSiteSelect: (): HTMLSelectElement => {
                return {} as HTMLSelectElement;
            },
            renderSiteGrid: (): void => { },
            getCurrentSiteId: (): string | null => {
                return null;
            },
            getEditMode: (): number => {
                return 1;
            },
            renderAllSiteGrid: (): void => { },
            getIsAdmin: (): boolean => {
                return true;
            },
        });
    };

    it('サーバー応答のWindowMetaDataで選択中のウィンドウ状態を更新する', (): void => {
        const manager = createManager();
        manager.selectDisplay('display-1', {
            id: 'window-1',
            displayId: 'display-1',
            posx: 0,
            posy: 0,
            virtualWidth: 800,
            virtualHeight: 600,
        });

        manager.updateWindowFrameByMetaData({
            id: 'window-1',
            displayId: 'display-1',
            posx: 240,
            posy: 120,
            virtualWidth: 960,
            virtualHeight: 540,
            pixelWidth: 1920,
            pixelHeight: 1080,
        });

        assert.strictEqual(manager.selectedWindowData.posx, 240);
        assert.strictEqual(manager.selectedWindowData.posy, 120);
        assert.strictEqual(manager.selectedWindowData.virtualWidth, 960);
        assert.strictEqual(manager.selectedWindowData.virtualHeight, 540);
    });

    it('未選択時は削除処理を実行しない', async (): Promise<void> => {
        const manager = createManager();
        const confirmSpy = mock.fn((): boolean => {
            return true;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;
        const deleteSpy = mock.fn(async (): Promise<void> => { });
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 0);
        assert.strictEqual(deleteSpy.mock.calls.length, 0);
    });

    it('確認OK時は deleteDisplay 実行後に選択解除する', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-1';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-1', displayName: 'Display One' },
        ];

        const confirmSpy = mock.fn((): boolean => {
            return true;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;

        const deleteSpy = mock.fn(async (): Promise<void> => { });
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 1);
        assert.strictEqual(deleteSpy.mock.calls.length, 1);
        assert.strictEqual((manager as any)._selectedDisplayId, null);
    });

    it('確認キャンセル時は削除処理を実行しない', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-2';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-2', displayName: 'Display Two' },
        ];

        const confirmSpy = mock.fn((): boolean => {
            return false;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;

        const deleteSpy = mock.fn(async (): Promise<void> => { });
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 1);
        assert.strictEqual(deleteSpy.mock.calls.length, 0);
        assert.strictEqual((manager as any)._selectedDisplayId, 'display-2');
    });

    it('確認文言には displayName を優先し、なければ displayId を使う', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-3';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-3', displayName: '' },
        ];

        const confirmSpy = mock.fn((message?: string): boolean => {
            assert.ok((message || '').includes('display-3'));
            return false;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;

        const deleteSpy = mock.fn(async (): Promise<void> => { });
        (manager as any).deleteDisplay = deleteSpy;

        await manager.deleteSelectedDisplay();

        assert.strictEqual(confirmSpy.mock.calls.length, 1);
        assert.strictEqual(deleteSpy.mock.calls.length, 0);
    });

    it('deleteDisplay が例外の場合は例外を伝播する', async (): Promise<void> => {
        const manager = createManager();
        (manager as any)._selectedDisplayId = 'display-4';
        (manager as any)._allApprovedDisplays = [
            { displayId: 'display-4', displayName: 'Display Four' },
        ];

        const confirmSpy = mock.fn((): boolean => {
            return true;
        });
        globalThis.confirm = confirmSpy as unknown as typeof globalThis.confirm;
        (manager as any).deleteDisplay = async (): Promise<void> => {
            throw new Error('delete failed');
        };

        await assert.rejects(
            async (): Promise<void> => {
                await manager.deleteSelectedDisplay();
            },
            (error: Error): boolean => {
                return error.message === 'delete failed';
            },
        );
    });

    it('confirm 差し替えを元に戻す', (): void => {
        globalThis.confirm = originalConfirm;
        assert.ok(true);
    });
});
