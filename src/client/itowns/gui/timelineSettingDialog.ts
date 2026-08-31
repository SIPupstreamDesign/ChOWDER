/**
 * タイムライン設定ダイアログ
 */

type SettingDialogCallback = (isOK: boolean, data?: { start: Date; end: Date }) => void;
type GetDateFn = () => Date;

export class TimelineSettingDialog {
    private getStartFn: GetDateFn;
    private getEndFn: GetDateFn;
    private dom: HTMLDivElement;
    private background: HTMLDivElement;
    private startInput!: HTMLInputElement;
    private endInput!: HTMLInputElement;
    private endCallback: SettingDialogCallback | null = null;

    constructor(getStartFn: GetDateFn, getEndFn: GetDateFn) {
        this.getStartFn = getStartFn;
        this.getEndFn = getEndFn;

        this.dom = document.createElement('div');
        this.dom.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:6px;z-index:1001;min-width:320px;';

        this.background = document.createElement('div');
        this.background.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;';
        document.body.appendChild(this.background);

        this.init();
    }

    private init(): void {
        const title = document.createElement('p');
        title.textContent = 'タイムライン設定';
        title.style.cssText = 'font-weight:bold;margin-bottom:12px;';
        this.dom.appendChild(title);

        const row = (label: string): HTMLInputElement => {
            const r = document.createElement('div');
            r.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.minWidth = '60px';
            r.appendChild(lbl);
            const inp = document.createElement('input');
            inp.type = 'datetime-local';
            inp.style.flex = '1';
            r.appendChild(inp);
            this.dom.appendChild(r);
            return inp;
        };

        this.startInput = row('開始:');
        this.endInput = row('終了:');

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.addEventListener('click', () => this.hide(false));
        btnRow.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'background:#007bff;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;';
        okBtn.addEventListener('click', () => {
            const start = new Date(this.startInput.value);
            const end = new Date(this.endInput.value);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
            this.hide(true, { start, end });
        });
        btnRow.appendChild(okBtn);
        this.dom.appendChild(btnRow);
    }

    show(callback: SettingDialogCallback): void {
        this.endCallback = callback;
        const fmt = (d: Date) => {
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        this.startInput.value = fmt(this.getStartFn());
        this.endInput.value = fmt(this.getEndFn());
        this.dom.style.display = 'block';
        this.background.style.display = 'block';
        document.body.appendChild(this.dom);
    }

    private hide(isOK: boolean, data?: { start: Date; end: Date }): void {
        this.dom.style.display = 'none';
        this.background.style.display = 'none';
        this.endCallback?.(isOK, data);
        this.endCallback = null;
    }

    getDOM(): HTMLDivElement {
        return this.dom;
    }
}
