/**
 * ITowns2Client
 *
 * Flux 風 Action/Store/Operation/EventEmitter を廃止し、
 * controller.ts と同様にシンプルな 1 クラス 1 ファイル構成にリファクタリング。
 */

import { ITownsMetaData, LayerData, RangeBar } from './types/types';
import { IFrameConnector } from './iframe/iframeConnector';
import { LayerList } from './gui/layerList';
import { LayerProperty } from './gui/layerProperty';
import { LayerDialog } from './gui/layerDialog';
import { TimelineSettingDialog } from './gui/timelineSettingDialog';
import { ITownsCommand } from './commands/itownsCommands';
import { ITownsConstants } from './constants/layerConstants';

// ===== MetaBinary ユーティリティ =====

const METABIN_HEAD = 'MetaBin:';

function createMetaBinary(json: object, binary: ArrayBuffer): ArrayBuffer {
    const enc = new TextEncoder();
    const metaBytes = enc.encode(JSON.stringify(json));
    const headBytes = enc.encode(METABIN_HEAD);
    const totalLen = headBytes.length + 4 + 4 + metaBytes.length + binary.byteLength;
    const buf = new ArrayBuffer(totalLen);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    let pos = 0;
    u8.set(headBytes, pos); pos += headBytes.length;
    view.setUint32(pos, 1, true); pos += 4;
    view.setUint32(pos, metaBytes.length, true); pos += 4;
    u8.set(metaBytes, pos); pos += metaBytes.length;
    u8.set(new Uint8Array(binary), pos);
    return buf;
}

function loadMetaBinary(data: ArrayBuffer, callback: (meta: any, binary: ArrayBuffer) => void): void {
    const enc = new TextEncoder();
    const headBytes = enc.encode(METABIN_HEAD);
    const dec = new TextDecoder('utf-8');
    const view = new DataView(data);
    let pos = headBytes.length;
    const _ver = view.getUint32(pos, true); pos += 4;
    const metaLen = view.getUint32(pos, true); pos += 4;
    const meta = JSON.parse(dec.decode(new Uint8Array(data, pos, metaLen)));
    callback(meta, data.slice(pos + metaLen));
}

function toArrayBuffer(base64: string): ArrayBuffer {
    const bin = atob(base64.replace(/^.*,/, ''));
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}

// ===== 型定義 =====

type Callback = (err: any, result?: any) => void;

interface ContentEntry {
    type: string;
    url: string;
    meta?: ITownsMetaData;
}

// ===== ITowns2Client =====

class ITowns2Client {
    // --- WebSocket ---
    private ws: WebSocket | null = null;
    private messageId = 1;
    private callbacks = new Map<string, Callback>();
    private receivers = new Map<string, (params: any) => void>();
    private isDisconnect = false;
    private debounceUpdateMetaTimer: ReturnType<typeof setTimeout> | null = null;

    // カメラ更新スロットル用
    private lastCameraSendTime = 0;
    private cameraTrailTimer: ReturnType<typeof setTimeout> | null = null;
    private static readonly CAMERA_INTERVAL_MS = 33;

    // --- 状態 ---
    private metaData: ITownsMetaData | null = null;
    private initialMatrix: any = null;
    private initialCameraParams: any = null;
    private csvCaches: Record<string, string> = {};
    private jsonCaches: Record<string, any> = {};
    private performanceResult: Record<string, any> = {};
    private timelineStartTime: Date;
    private timelineEndTime: Date;
    private timelineCurrentTime: Date;
    private timelineRangeBar: RangeBar | null = null;
    private isPlayingTimeline = false;
    private playIntervalId: ReturnType<typeof setInterval> | null = null;
    private currentEntry: ContentEntry | null = null;
    private initialContent: ContentEntry | null = null;

    // --- IFrame ---
    private iframeConnector: IFrameConnector | null = null;
    private iframe: HTMLIFrameElement | null = null;

    // --- GUI 部品 ---
    private loginView!: HTMLDivElement;
    private loginErrorMsg!: HTMLParagraphElement;
    private userIdInput!: HTMLInputElement;
    private passwordInput!: HTMLInputElement;
    private viewerView!: HTMLDivElement;
    private contentSelect: HTMLSelectElement | null = null;
    private layerList!: LayerList;
    private layerProperty!: LayerProperty;
    private layerDialog!: LayerDialog;
    private timelineCurrentTimeEl!: HTMLDivElement;
    private timelinePlayBtn!: HTMLButtonElement;
    private timelineSyncBtn!: HTMLButtonElement;
    private timelineSettingDialog!: TimelineSettingDialog;

    constructor() {
        const now = new Date();
        this.timelineStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        this.timelineEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        this.timelineCurrentTime = new Date(Date.now());
    }

    // ===== ライフサイクル =====

    init(): void {
        this.initLoginView();
        this.initViewerView();
        this.showLoginView();
    }

    setInitialContent(entry: ContentEntry): void {
        this.initialContent = entry;
    }

    // ===== WebSocket =====

    connect(onConnected?: () => void): void {
        this.isDisconnect = false;
        const proto = document.URL.startsWith('https') ? 'wss://' : 'ws://';
        const port = location.port ? `:${location.port}` : '';
        const url = `${proto}${location.hostname}${port}/`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.onConnectSuccess();
            onConnected?.();
        };
        this.ws.onclose = () => {
            if (!this.isDisconnect) {
                setTimeout(() => this.connect(onConnected), 2000);
            }
        };
        this.ws.onmessage = (message) => {
            const data = message.data;
            if (typeof data === 'string') {
                if (data.startsWith(METABIN_HEAD)) {
                    // 文字列に見えるが実は MetaBin ヘッダ（稀なケース）
                    return;
                }
                try {
                    this.handleTextMessage(JSON.parse(data));
                } catch (e) {
                    console.error('[ITowns2Client] JSON parse error', e);
                }
            } else {
                const handleBuf = (buf: ArrayBuffer) => {
                    loadMetaBinary(buf, (meta, content) => {
                        this.handleBinaryMessage(meta, content);
                    });
                };
                if (data instanceof ArrayBuffer) handleBuf(data);
                else if (data instanceof Blob) data.arrayBuffer().then(handleBuf);
            }
        };
    }

    private handleTextMessage(meta: any): void {
        if (meta.to === 'client') {
            // サーバーからのプッシュ
            this.receivers.get(meta.method)?.(meta.params);
        } else {
            const cb = this.callbacks.get(String(meta.id));
            if (cb) {
                this.callbacks.delete(String(meta.id));
                if (meta.error) cb(meta.error, null);
                else cb(null, meta.result);
            }
        }
    }

    private handleBinaryMessage(meta: any, contentData: ArrayBuffer): void {
        if (meta.to === 'client') {
            this.receivers.get(meta.method)?.({ metaData: meta.params, contentData });
        } else {
            const cb = this.callbacks.get(String(meta.id));
            if (cb) {
                this.callbacks.delete(String(meta.id));
                if (meta.error) cb(meta.error, null);
                else cb(null, { metaData: meta.result, contentData });
            }
        }
    }

    private sendCommand(method: string, params: any, cb: Callback = () => {}): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            cb(-1, null);
            return;
        }
        const id = String(this.messageId++);
        this.callbacks.set(id, cb);
        const req = { jsonrpc: '2.0', type: 'utf8', id, method, params, to: 'master' };
        this.ws.send(JSON.stringify(req));
    }

    private sendCommandDebounced(method: string, params: any, cb: Callback = () => {}): void {
        // UpdateMetaData はデバウンス
        if (this.debounceUpdateMetaTimer != null) clearTimeout(this.debounceUpdateMetaTimer);
        this.debounceUpdateMetaTimer = setTimeout(() => this.sendCommand(method, params, cb), 100);
    }

    private sendBinaryCommand(method: string, meta: any, binary: ArrayBuffer, cb: Callback = () => {}): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            cb(-1, null);
            return;
        }
        const id = String(this.messageId++);
        this.callbacks.set(id, cb);
        const header = { jsonrpc: '2.0', type: 'binary', id, method, params: meta, to: 'master' };
        const buf = createMetaBinary(header, binary);
        this.ws.send(buf);
    }

    // ===== 接続後の処理 =====

    private onConnectSuccess(): void {
        this.sendCommand('GetGlobalSetting', {}, () => {/* ignore */});

        // サーバーからのプッシュ登録
        this.receivers.set('UpdateMetaData', (payload: any) => {
            // サーバーは { metadata: updatedMetadata } 形式で送信する
            const list: any[] = Array.isArray(payload) ? payload
                : payload?.metadata ? [payload.metadata]
                : payload?.metaDataList ? payload.metaDataList
                : [];
            for (const meta of list) {
                const id = meta.metadataId ?? meta.id;
                const myId = this.metaData?.metadataId ?? this.metaData?.id;
                if (meta.type === 'webgl' && this.metaData && id === myId) {
                    this.metaData = meta;
                    this.syncLayersFromMetaData();
                    break;
                }
            }
        });
        this.receivers.set('SendMessage', (data: any) => {
            if (data?.command === 'measureITownPerformanceResult') {
                if (this.metaData?.id === data.id) {
                    this.performanceResult[data.display_id] = data.result;
                }
            }
            if (data?.command === 'changeItownsContentTime') {
                const d = data.data;
                if (d?.time && this.isTimelineSync(d.id, d.senderSync)) {
                    if (this.timelineCurrentTime.toJSON() !== d.time) {
                        const range = (this.timelineEndTime.getTime() - this.timelineStartTime.getTime()) / 2;
                        this.timelineCurrentTime = new Date(d.time);
                        this.timelineStartTime = new Date(this.timelineCurrentTime.getTime() - range);
                        this.timelineEndTime = new Date(this.timelineCurrentTime.getTime() + range);
                        const msg: any = { time: d.time };
                        if (d.rangeStartTime && d.rangeEndTime) {
                            msg.rangeStartTime = d.rangeStartTime;
                            msg.rangeEndTime = d.rangeEndTime;
                        }
                        this.iframeConnector?.send(ITownsCommand.UpdateTime, msg);
                        this.updateTimelineDisplay();
                    }
                }
            }
        });
    }

    // ===== 認証 =====

    loginWithOTP(token: string): void {
        this.sendCommand('LoginWithOTP', { token }, (err, reply) => {
            if (err || !reply?.success) {
                this.showLoginView('OTPの有効期限が切れているか無効です。手動でログインしてください。');
            } else {
                this.onLoginSuccess();
            }
        });
    }

    private loginManual(id: string, password: string): void {
        this.sendCommand('Login', { id, password }, (err, reply) => {
            if (err || !reply) {
                this.showLoginView('ログインに失敗しました。IDとパスワードを確認してください。');
            } else {
                this.onLoginSuccess();
            }
        });
    }

    private onLoginSuccess(): void {
        this.hideLoginView();
        if (this.viewerView) this.viewerView.style.display = 'block';
        this.fetchContents();
        if (this.initialContent) {
            const entry = this.initialContent;
            this.initialContent = null;
            this.loadContent(entry);
        }
    }

    // ===== コンテンツ =====

    private fetchContents(): void {
        this.sendCommand('GetMetaData', { type: 'all', id: '' }, (err, metaData) => {
            if (!err && metaData?.type === 'webgl' && !metaData.webglType) {
                this.addUserContentOption(metaData);
            }
        });
    }

    private addContent(meta: any, binary: ArrayBuffer, onSuccess?: (metadataId: string) => void): void {
        this.sendBinaryCommand('AddContent', meta, binary, (err, reply) => {
            if (err || !reply) {
                console.error('[ITowns2Client] AddContent failed', err);
                return;
            }
            const resultMeta: ITownsMetaData = reply.metaData ?? reply;
            const isInitial = !this.metaData;
            this.metaData = resultMeta;
            if (isInitial && this.initialMatrix) {
                this.updateCamera(this.initialMatrix, this.initialCameraParams);
            }
            onSuccess?.(resultMeta.metadataId ?? resultMeta.id ?? '');
        });
    }

    private updateMetadata(metaData: Partial<ITownsMetaData>, cb?: () => void): void {
        // cameraWorldMatrix/cameraParams は UpdateCameraMatrix コマンドで別途送信するため除外
        const { cameraWorldMatrix: _cwm, cameraParams: _cp, ...safeData } = metaData as any;
        this.sendCommandDebounced('UpdateMetaData', [safeData], (err) => {
            if (!err) cb?.();
        });
    }

    /**
     * カメラ更新をスロットル（33ms間隔）＋トレイリングデバウンス（33ms）で送信する。
     * 慣性移動中もほぼリアルタイムに伝わりつつ、最終位置も確実に届く。
     * UpdateCameraMatrix コマンドを使用する（UpdateMetaData とは別経路）。
     */
    private sendCameraUpdateThrottled(payload: { metadataId?: string; id?: string; cameraWorldMatrix: any; cameraParams: any }): void {
        // トレイリングタイマーを常にリセット（最終フレームを確実に送る）
        if (this.cameraTrailTimer !== null) clearTimeout(this.cameraTrailTimer);
        this.cameraTrailTimer = setTimeout(() => {
            this.cameraTrailTimer = null;
            this.sendCommand('UpdateCameraMatrix', payload);
            this.lastCameraSendTime = Date.now();
        }, ITowns2Client.CAMERA_INTERVAL_MS);

        // スロットル: 前回送信から十分な時間が経過していれば即時送信
        const now = Date.now();
        if (now - this.lastCameraSendTime >= ITowns2Client.CAMERA_INTERVAL_MS) {
            if (this.cameraTrailTimer !== null) {
                clearTimeout(this.cameraTrailTimer);
                this.cameraTrailTimer = null;
            }
            this.sendCommand('UpdateCameraMatrix', payload);
            this.lastCameraSendTime = now;
        }
    }

    private uploadFile(filename: string, type: string, binary: ArrayBuffer, cb: (err: any, result?: any) => void): void {
        this.sendBinaryCommand('Upload', { filename, type }, binary, cb);
    }

    // ===== IFrame 接続 =====

    private connectIFrame(iframe: HTMLIFrameElement): void {
        this.iframeConnector = new IFrameConnector(iframe);
        this.iframeConnector.connect(() => {
            this.iframeConnector!.on(ITownsCommand.AddLayer, (_err: any, params: LayerData[]) => {
                this.excludeAndCacheCSV(params);
                this.excludeAndCacheJSON(params);
                if (params.length > 0 && this.metaData) {
                    const layerList: LayerData[] = JSON.parse(this.metaData.layerList);
                    for (const p of params) {
                        if (!this.getLayerData(p.id)) layerList.push(p);
                    }
                    this.metaData.layerList = JSON.stringify(layerList);
                    this.updateMetadata(this.metaData, () => {
                        this.layerList?.initLayerSelectList(this.getLayerList());
                    });
                    return;
                }
                this.layerList?.initLayerSelectList(params);
            });

            this.iframeConnector!.on(ITownsCommand.DeleteLayer, () => {});

            this.iframeConnector!.on(ITownsCommand.UpdateLayer, (_err: any, params: LayerData[]) => {
                this.excludeAndCacheCSV(params);
                if (params.length > 0 && this.metaData) {
                    const layerList = params.filter((p) => this.getLayerData(p.id));
                    this.metaData.layerList = JSON.stringify(layerList);
                    this.updateMetadata(this.metaData);
                }
                this.layerList?.initLayerSelectList(params);
            });

            this.iframeConnector!.on(ITownsCommand.UpdateCamera, (_err: any, params: any) => {
                this.updateCamera(params.mat, params.params);
            });

            this.iframeConnector!.on(ITownsCommand.AddContent, (_err: any, params: any, req: any) => {
                const entry = this.currentEntry;
                if (!entry || entry.type === 'user') return;
                const thumbnailBuffer = params.thumbnail ? toArrayBuffer(params.thumbnail) : new ArrayBuffer(0);
                console.log('[ITowns2] AddContent received: thumbnail length =', params.thumbnail?.length ?? 0, 'buffer byteLength =', thumbnailBuffer.byteLength);
                const w = window.innerWidth;
                const h = window.innerHeight;
                const metaData = {
                    type: 'webgl',
                    user_data_text: JSON.stringify({ text: entry.url }),
                    posx: 0, posy: 0,
                    width: w, height: h,
                    orgWidth: w, orgHeight: h,
                    visible: true,
                    layerList: JSON.stringify(params.layerList ?? []),
                    url: decodeURI(entry.url),
                };
                this.addContent(metaData, thumbnailBuffer, (metadataId: string) => {
                    console.log('[ITowns2] addContent onSuccess: metadataId =', metadataId, 'thumbnail byteLength =', thumbnailBuffer.byteLength);
                    // chowder_injection が生成したサムネイルを UpdateThumbnail で送信
                    if (thumbnailBuffer.byteLength > 0) {
                        console.log('[ITowns2] Sending UpdateThumbnail for', metadataId);
                        this.sendBinaryCommand('UpdateThumbnail', { metadataId }, thumbnailBuffer);
                    } else {
                        console.warn('[ITowns2] thumbnailBuffer is empty, skipping UpdateThumbnail');
                    }
                });
                this.iframeConnector!.sendResponse(req);
            });
        });
    }

    // ===== カメラ =====

    private updateCamera(mat: any, params: any): void {
        if (this.metaData) {
            // カメラ更新時は UpdateCameraMatrix でカメラ情報のみ送信。
            // this.metaData にはカメラを保持しないので UpdateMetaData けに混入しない。
            const payload = {
                metadataId: this.metaData.metadataId,
                id: this.metaData.id,
                cameraWorldMatrix: mat,
                cameraParams: params,
            };
            this.sendCameraUpdateThrottled(payload);
        } else {
            this.initialMatrix = mat;
            this.initialCameraParams = params;
        }
    }

    // ===== レイヤー操作 =====

    addLayer(data: any): void {
        this.iframeConnector?.send(ITownsCommand.AddLayer, data);
    }

    selectLayer(id: string): void {
        this.iframeConnector?.send(ITownsCommand.SelectLayer, { id });
    }

    deleteLayer(id: string): void {
        if (!this.metaData) return;
        const layerList: LayerData[] = JSON.parse(this.metaData.layerList);
        const idx = layerList.findIndex((l) => l?.id === id);
        if (idx < 0) return;
        layerList.splice(idx, 1);
        this.metaData.layerList = JSON.stringify(layerList);
        this.iframeConnector?.send(ITownsCommand.DeleteLayer, { id }, (_err) => {
            this.updateMetadata(this.metaData!, () => {
                this.layerList?.initLayerSelectList(this.getLayerList());
            });
        });
    }

    changeLayerProperty(data: Partial<LayerData> & { id: string; callback?: () => void }): void {
        const layer = this.getLayerData(data.id);
        if (!layer) return;
        for (const key of Object.keys(data)) {
            if (key !== 'id' && key !== 'callback') (layer as any)[key] = (data as any)[key];
        }
        this.saveLayer(layer);
        this.updateMetadata(this.metaData!, () => {
            data.callback?.();
            this.layerProperty?.show(layer);
        });
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.iframeConnector?.send(ITownsCommand.ChangeLayerProperty, layer);
        }
    }

    // ===== タイムライン =====

    changeTime(currentTime: Date): void {
        this.timelineCurrentTime = currentTime;
        if (currentTime < this.timelineStartTime || currentTime > this.timelineEndTime) {
            const span = (this.timelineEndTime.getTime() - this.timelineStartTime.getTime()) / 2;
            this.timelineStartTime = new Date(currentTime.getTime() - span);
            this.timelineEndTime = new Date(currentTime.getTime() + span);
        }
        if (this.metaData) {
            const msg = {
                command: 'changeItownsContentTime',
                data: {
                    time: currentTime.toJSON(),
                    rangeStartTime: this.timelineRangeBar?.rangeStartTime.toJSON() ?? '',
                    rangeEndTime: this.timelineRangeBar?.rangeEndTime.toJSON() ?? '',
                    id: this.metaData.id,
                    senderSync: this.metaData.sync === true,
                },
            };
            this.sendCommand('SendMessage', msg, () => {
                this.iframeConnector?.send(ITownsCommand.UpdateTime, {
                    time: currentTime.toJSON(),
                    rangeStartTime: this.timelineRangeBar?.rangeStartTime.toJSON() ?? '',
                    rangeEndTime: this.timelineRangeBar?.rangeEndTime.toJSON() ?? '',
                });
            });
        }
        this.updateTimelineDisplay();
    }

    private updateTimelineDisplay(): void {
        if (this.timelineCurrentTimeEl) {
            this.timelineCurrentTimeEl.textContent = this.getTimelineCurrentTimeString();
        }
    }

    private getTimelineCurrentTimeString(): string {
        const t = this.timelineCurrentTime;
        const pad = (n: number) => String(n).padStart(2, '0');
        const offset = t.getTimezoneOffset();
        const sign = offset <= 0 ? '+' : '-';
        const absH = Math.floor(Math.abs(offset) / 60);
        const absM = Math.abs(offset) % 60;
        const offsetStr = absM > 0 ? `GMT${sign}${absH}:${absM}` : `GMT${sign}${absH}`;
        return `${t.getFullYear()}/${pad(t.getMonth() + 1)}/${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())} ${offsetStr}`;
    }

    private isTimelineSync(targetId?: string, senderSync?: boolean): boolean {
        if (!this.metaData) return false;
        const sync = this.metaData.sync === true;
        if (targetId !== undefined && !sync) return this.metaData.id === targetId;
        if (senderSync !== undefined) return sync || senderSync;
        return sync;
    }

    // ===== データアクセス =====

    private getLayerData(layerID: string): LayerData | null {
        if (!this.metaData?.layerList) return null;
        try {
            const list: LayerData[] = JSON.parse(this.metaData.layerList);
            return list.find((l) => l?.id === layerID) ?? null;
        } catch { return null; }
    }

    private getLayerList(): LayerData[] {
        if (!this.metaData?.layerList) return [];
        try { return JSON.parse(this.metaData.layerList); } catch { return []; }
    }

    private saveLayer(layer: LayerData): void {
        if (!this.metaData?.layerList) return;
        const list: LayerData[] = JSON.parse(this.metaData.layerList);
        const idx = list.findIndex((l) => l?.id === layer.id);
        if (idx >= 0) {
            list[idx] = layer;
            this.metaData.layerList = JSON.stringify(list);
        }
    }

    private syncLayersFromMetaData(): void {
        if (this.iframeConnector && this.metaData?.layerList) {
            const layerList: LayerData[] = JSON.parse(this.metaData.layerList);
            for (const layer of layerList) {
                if (layer) this.iframeConnector.send(ITownsCommand.ChangeLayerProperty, layer);
            }
        }
    }

    private excludeAndCacheCSV(layers: any[]): void {
        for (const layer of layers) {
            if (layer.csv) { this.csvCaches[layer.id] = layer.csv; delete layer.csv; break; }
        }
    }

    private excludeAndCacheJSON(layers: any[]): void {
        for (const layer of layers) {
            if (layer.json) { this.jsonCaches[layer.id] = layer.json; delete layer.json; break; }
        }
    }

    // ===== GUI 初期化 =====

    private initLoginView(): void {
        this.loginView = (document.getElementById('login_view') as HTMLDivElement) ?? (() => {
            const el = document.createElement('div');
            el.id = 'login_view';
            document.body.appendChild(el);
            return el;
        })();
        this.loginView.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;z-index:100;';

        const box = document.createElement('div');
        box.style.cssText =
            'background:#fff;padding:32px;border-radius:8px;min-width:320px;box-shadow:0 2px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:12px;';

        const title = document.createElement('h2');
        title.textContent = 'ChOWDER iTowns';
        title.style.margin = '0 0 8px 0';
        box.appendChild(title);

        this.loginErrorMsg = document.createElement('p');
        this.loginErrorMsg.style.cssText = 'color:red;font-size:13px;min-height:18px;margin:0;';
        box.appendChild(this.loginErrorMsg);

        const makeRow = (label: string): HTMLDivElement => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.fontSize = '13px';
            row.appendChild(lbl);
            box.appendChild(row);
            return row;
        };

        const idRow = makeRow('ユーザーID');
        this.userIdInput = document.createElement('input');
        this.userIdInput.type = 'text';
        this.userIdInput.placeholder = 'user id';
        this.userIdInput.style.cssText = 'padding:8px;border:1px solid #ccc;border-radius:4px;';
        idRow.appendChild(this.userIdInput);

        const pwRow = makeRow('パスワード');
        this.passwordInput = document.createElement('input');
        this.passwordInput.type = 'password';
        this.passwordInput.placeholder = 'password';
        this.passwordInput.style.cssText = 'padding:8px;border:1px solid #ccc;border-radius:4px;';
        pwRow.appendChild(this.passwordInput);

        const loginBtn = document.createElement('button');
        loginBtn.textContent = 'ログイン';
        loginBtn.style.cssText =
            'background:#007bff;color:#fff;border:none;padding:10px;border-radius:4px;cursor:pointer;font-size:15px;';
        loginBtn.addEventListener('click', () => this.doManualLogin());
        this.passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.doManualLogin(); });
        box.appendChild(loginBtn);

        this.loginView.appendChild(box);
    }

    private doManualLogin(): void {
        const id = this.userIdInput.value.trim();
        const pw = this.passwordInput.value;
        if (!id || !pw) {
            this.loginErrorMsg.textContent = 'IDとパスワードを入力してください';
            return;
        }
        this.loginManual(id, pw);
    }

    showLoginView(errorMessage?: string): void {
        this.loginView.style.display = 'flex';
        if (this.viewerView) this.viewerView.style.display = 'none';
        if (errorMessage) this.loginErrorMsg.textContent = errorMessage;
    }

    private hideLoginView(): void {
        this.loginView.style.display = 'none';
    }

    private initViewerView(): void {
        this.viewerView = (document.getElementById('viewer_view') as HTMLDivElement) ?? (() => {
            const el = document.createElement('div');
            el.id = 'viewer_view';
            document.body.appendChild(el);
            return el;
        })();
        this.viewerView.style.cssText = 'display:none;width:100%;height:100%;';

        this.initHeadMenu();
        this.initPropertyPanel();
        this.initTimeline();
        this.initResize();
    }

    private initHeadMenu(): void {
        this.contentSelect = null;
    }

    private loadPresets(): void {
        const contentSelect = this.contentSelect;
        if (contentSelect === null) {
            return;
        }
        fetch('/itowns/Preset/preset_list.json')
            .then((r) => r.json())
            .then((json) => {
                for (const preset of json.preset_list ?? []) {
                    const url = preset.url.startsWith('/') || preset.url.startsWith('http')
                        ? preset.url
                        : '/' + preset.url;
                    const opt = document.createElement('option');
                    opt.value = JSON.stringify({ type: 'preset', url });
                    opt.textContent = 'Preset:' + preset.name;
                    contentSelect.appendChild(opt);
                }
            })
            .catch(() => {/* no presets */ });
    }

    private addUserContentOption(meta: ITownsMetaData): void {
        if (this.contentSelect === null) {
            return;
        }
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ type: 'user', url: (meta as any).url, meta });
        opt.textContent = 'ContentID:' + meta.id;
        this.contentSelect.appendChild(opt);
    }

    private onContentSelected(): void {
        if (this.contentSelect === null) {
            return;
        }
        const val = this.contentSelect.value;
        if (!val) return;
        try {
            this.loadContent(JSON.parse(val));
        } catch (e) {
            console.error('[ITowns2Client] onContentSelected parse error', e);
        }
    }

    private loadContent(entry: ContentEntry): void {
        this.currentEntry = entry;
        const itownsEl = document.getElementById('itowns');
        if (!itownsEl) return;

        while (itownsEl.firstChild) itownsEl.removeChild(itownsEl.firstChild);

        this.iframe = document.createElement('iframe');
        this.iframe.style.cssText = 'width:100%;height:100%;border:none;';
        const src = entry.url.startsWith('/') || entry.url.startsWith('http')
            ? entry.url
            : '/' + entry.url;
        this.iframe.src = src;
        itownsEl.appendChild(this.iframe);

        this.iframe.addEventListener('load', () => {
            (this.iframe!.contentWindow as any).chowder_itowns_view_type = 'itowns';
            this.connectIFrame(this.iframe!);
            if (entry.type === 'user' && entry.meta) {
                this.loadUserData(entry.meta);
            }
        });
    }

    private loadUserData(meta: ITownsMetaData): void {
        let layerList: LayerData[] = [];
        try { layerList = JSON.parse(meta.layerList); } catch (e) {
            console.error('[ITowns2Client] loadUserData', e);
        }
        this.metaData = meta;
        // GetContent レスポンスにはサーバーが content:camera から merge したカメラデータが含まれる場合がある
        const initialCamera = meta as any;
        if (initialCamera.cameraWorldMatrix) {
            this.iframeConnector?.send(ITownsCommand.UpdateCamera, {
                mat: JSON.parse(initialCamera.cameraWorldMatrix),
                params: JSON.parse(initialCamera.cameraParams ?? '{}'),
            });
        }
        if (layerList.length > 0) {
            this.iframeConnector?.send(ITownsCommand.InitLayers, layerList, () => {
                this.iframeConnector?.send(ITownsCommand.UpdateTime, {
                    time: this.timelineCurrentTime.toJSON(),
                    rangeStartTime: this.timelineRangeBar?.rangeStartTime.toJSON() ?? '',
                    rangeEndTime: this.timelineRangeBar?.rangeEndTime.toJSON() ?? '',
                });
            });
            this.layerList?.initLayerSelectList(layerList);
        }
    }

    private initPropertyPanel(): void {
        const propEl = document.getElementById('itowns_property');
        if (!propEl) return;
        propEl.style.cssText =
            'position:fixed;right:0;top:0;width:220px;height:calc(100% - 40px);background:#fff;border-left:1px solid #ddd;overflow-y:auto;padding:8px;font-size:13px;';

        const layerTitle = document.createElement('p');
        layerTitle.textContent = 'レイヤー一覧';
        layerTitle.style.cssText = 'font-weight:bold;margin:4px 0 6px 0;';
        propEl.appendChild(layerTitle);

        this.layerDialog = new LayerDialog(
            (filename, type, binary, cb) => this.uploadFile(filename, type, binary, cb)
        );
        this.layerList = new LayerList(
            (data) => this.addLayer(data),
            (id) => this.deleteLayer(id),
            (id) => this.selectLayer(id),
            this.layerDialog
        );
        propEl.appendChild(this.layerList.getDOM());

        const hr = document.createElement('hr');
        hr.style.margin = '10px 0';
        propEl.appendChild(hr);

        const propTitle = document.createElement('p');
        propTitle.textContent = 'レイヤープロパティ';
        propTitle.style.cssText = 'font-weight:bold;margin:4px 0 6px 0;';
        propEl.appendChild(propTitle);

        this.layerProperty = new LayerProperty(
            (data) => this.changeLayerProperty(data)
        );
        propEl.appendChild(this.layerProperty.getDOM());

        this.layerList.onLayerSelected((id) => {
            const layer = this.getLayerData(id);
            if (layer) this.layerProperty.show(layer);
        });
    }

    private initTimeline(): void {
        const timelineWrap = document.getElementById('timeline_wrap');
        if (!timelineWrap) return;
        timelineWrap.style.cssText =
            'position:fixed;bottom:0;left:0;width:100%;background:#222;padding:4px 8px;display:flex;align-items:center;gap:8px;';

        this.timelineCurrentTimeEl = document.createElement('div');
        this.timelineCurrentTimeEl.style.cssText = 'color:#fff;font-size:12px;min-width:180px;';
        this.timelineCurrentTimeEl.textContent = this.getTimelineCurrentTimeString();
        timelineWrap.appendChild(this.timelineCurrentTimeEl);

        this.timelinePlayBtn = document.createElement('button');
        this.timelinePlayBtn.textContent = '▶';
        this.timelinePlayBtn.style.cssText =
            'background:#444;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;';
        this.timelinePlayBtn.addEventListener('click', () => this.toggleTimelinePlay());
        timelineWrap.appendChild(this.timelinePlayBtn);

        this.timelineSyncBtn = document.createElement('button');
        this.timelineSyncBtn.textContent = 'Sync';
        this.timelineSyncBtn.style.cssText =
            'background:#007bff;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;';
        this.timelineSyncBtn.addEventListener('click', () => {
            const isSync = this.metaData?.sync === true;
            if (this.metaData) {
                this.metaData.sync = !isSync;
                this.updateMetadata(this.metaData);
            }
            this.timelineSyncBtn.style.background = isSync ? '#444' : '#007bff';
        });
        timelineWrap.appendChild(this.timelineSyncBtn);

        this.timelineSettingDialog = new TimelineSettingDialog(
            () => this.timelineStartTime,
            () => this.timelineEndTime
        );
        const settingBtn = document.createElement('button');
        settingBtn.textContent = '⚙';
        settingBtn.style.cssText =
            'background:#444;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;';
        settingBtn.addEventListener('click', () => {
            this.timelineSettingDialog.show((isOK, data) => {
                if (isOK && data) {
                    this.timelineStartTime = data.start;
                    this.timelineEndTime = data.end;
                    if (this.timelineCurrentTime < this.timelineStartTime)
                        this.timelineCurrentTime = this.timelineStartTime;
                    if (this.timelineCurrentTime > this.timelineEndTime)
                        this.timelineCurrentTime = this.timelineEndTime;
                    this.updateTimelineDisplay();
                }
            });
        });
        timelineWrap.appendChild(settingBtn);
    }

    private toggleTimelinePlay(): void {
        this.isPlayingTimeline = !this.isPlayingTimeline;
        if (this.isPlayingTimeline) {
            this.timelinePlayBtn.textContent = '⏸';
            this.playIntervalId = setInterval(() => {
                this.changeTime(new Date(this.timelineCurrentTime.getTime() + 1000));
            }, 1000);
        } else {
            this.timelinePlayBtn.textContent = '▶';
            if (this.playIntervalId != null) { clearInterval(this.playIntervalId); this.playIntervalId = null; }
        }
    }

    private initResize(): void {
        let timer: ReturnType<typeof setTimeout> | null = null;
        window.addEventListener('resize', () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                if (!this.metaData) return;
                // #itowns 要素のサイズを使用する。
                // window.innerWidth/innerHeight はヘッダー・サイドパネルを含む全画面サイズなので不正確。
                const itownsEl = document.getElementById('itowns');
                const w = itownsEl ? itownsEl.clientWidth : window.innerWidth;
                const h = itownsEl ? itownsEl.clientHeight : window.innerHeight;
                this.metaData.width = w;
                this.metaData.height = h;
                this.updateMetadata({
                    metadataId: this.metaData.metadataId,
                    id: this.metaData.id,
                    width: w,
                    height: h,
                });
            }, 200);
        });
    }
}

// ===== エントリポイント =====

function main(): void {
    const client = new ITowns2Client();
    client.init();

    const urlParams = new URLSearchParams(location.search);
    const otp = urlParams.get('otp');
    const contentParam = urlParams.get('content');

    if (contentParam) {
        try {
            client.setInitialContent(JSON.parse(contentParam));
        } catch (e) {
            console.warn('[itowns2] Invalid content param', e);
        }
    }

    client.connect(() => {
        if (otp) client.loginWithOTP(otp);
        // OTP がない場合は手動ログインフォームが表示されたままにする
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

