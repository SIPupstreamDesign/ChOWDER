import type { DisplayUpdateData } from '../types';

export interface DisplayUpdateOperation {
    cancelled: boolean;
}

interface PendingDisplayUpdate {
    data: DisplayUpdateData;
    operation?: DisplayUpdateOperation;
    resolve: () => void;
    reject: (error: unknown) => void;
}

/** Keeps cancellable contributions separate until a window is ready to send. */
export class DisplayUpdateQueue {
    private readonly pending = new Map<string, PendingDisplayUpdate[]>();
    private readonly running = new Map<string, Promise<void>>();

    constructor(private readonly send: (data: DisplayUpdateData) => Promise<void>) { }

    enqueue(data: DisplayUpdateData, operation?: DisplayUpdateOperation): Promise<void> {
        return new Promise<void>((resolve, reject): void => {
            if (operation?.cancelled === true) { resolve(); return; }
            const updates = this.pending.get(data.windowId) ?? [];
            updates.push({ data, operation, resolve, reject });
            this.pending.set(data.windowId, updates);
        });
    }

    cancel(operation: DisplayUpdateOperation): void {
        operation.cancelled = true;
        for (const [windowId, updates] of this.pending) {
            const remaining = updates.filter((update): boolean => {
                if (update.operation !== operation) { return true; }
                update.resolve();
                return false;
            });
            if (remaining.length === 0) { this.pending.delete(windowId); }
            else { this.pending.set(windowId, remaining); }
        }
    }

    flush(): void {
        for (const windowId of this.pending.keys()) { this.startNext(windowId); }
    }

    async whenIdle(windowId: string): Promise<void> {
        this.startNext(windowId);
        while (this.running.has(windowId)) { await this.running.get(windowId); }
    }

    private startNext(windowId: string): void {
        if (this.running.has(windowId)) { return; }
        const updates = this.pending.get(windowId);
        if (updates === undefined) { return; }
        this.pending.delete(windowId);
        const valid = updates.filter((update): boolean => {
            if (update.operation?.cancelled !== true) { return true; }
            update.resolve();
            return false;
        });
        if (valid.length === 0) { return; }
        const request = Promise.resolve().then(async (): Promise<void> => {
            const contributions = valid.filter((update): boolean => {
                if (update.operation?.cancelled !== true) { return true; }
                update.resolve();
                return false;
            });
            if (contributions.length === 0) { return; }
            const [data] = coalesceDisplayUpdateData(contributions.map((update): DisplayUpdateData => { return update.data; }));
            try {
                await this.send(data);
                contributions.forEach((update): void => { update.resolve(); });
            } catch (error: unknown) {
                contributions.forEach((update): void => { update.reject(error); });
            }
        }).finally((): void => {
            this.running.delete(windowId);
            this.startNext(windowId);
        });
        this.running.set(windowId, request);
    }
}

export function coalesceDisplayUpdateData(updates: DisplayUpdateData[]): DisplayUpdateData[] {
    const updatesByWindowId = new Map<string, DisplayUpdateData>();

    for (const update of updates) {
        const merged: DisplayUpdateData = {
            ...updatesByWindowId.get(update.windowId),
            ...update,
        };

        if (update.virtualWidth !== undefined && update.virtualHeight === undefined) {
            delete merged.virtualHeight;
        } else if (update.virtualHeight !== undefined && update.virtualWidth === undefined) {
            delete merged.virtualWidth;
        }

        updatesByWindowId.set(update.windowId, merged);
    }

    return [...updatesByWindowId.values()];
}