export type TileImageProgressCallback = (completed: number, total: number) => void;
export type CancelTileImageProgressTimer = () => void;
export type ScheduleTileImageProgressTimer = (callback: () => void, delayMs: number) => CancelTileImageProgressTimer;

export class TileImageProgressBroadcaster {
    private lastSentAt: number | null = null;
    private pendingProgress: { completed: number; total: number } | null = null;
    private cancelTimer: CancelTileImageProgressTimer | null = null;
    private disposed = false;

    constructor(
        private readonly sendProgress: TileImageProgressCallback,
        private readonly intervalMs: number = 250,
        private readonly now: () => number = (): number => { return Date.now(); },
        private readonly schedule: ScheduleTileImageProgressTimer = (
            callback: () => void,
            delayMs: number,
        ): CancelTileImageProgressTimer => {
            const timer = setTimeout(callback, delayMs);
            return (): void => { clearTimeout(timer); };
        },
    ) { }

    publish(completed: number, total: number): void {
        if (this.disposed) {
            return;
        }

        const progress = { completed, total };
        if (completed >= total) {
            this.clearPendingProgress();
            this.send(progress);
            return;
        }

        if (this.lastSentAt === null || this.now() - this.lastSentAt >= this.intervalMs) {
            this.clearPendingProgress();
            this.send(progress);
            return;
        }

        this.pendingProgress = progress;
        if (this.cancelTimer === null) {
            const remainingMs = this.intervalMs - (this.now() - this.lastSentAt);
            this.cancelTimer = this.schedule((): void => {
                this.cancelTimer = null;
                this.flushPendingProgress();
            }, remainingMs);
        }
    }

    dispose(): void {
        this.disposed = true;
        this.clearPendingProgress();
    }

    private flushPendingProgress(): void {
        const progress = this.pendingProgress;
        this.pendingProgress = null;
        if (progress !== null && !this.disposed) {
            this.send(progress);
        }
    }

    private clearPendingProgress(): void {
        if (this.cancelTimer !== null) {
            this.cancelTimer();
            this.cancelTimer = null;
        }
        this.pendingProgress = null;
    }

    private send(progress: { completed: number; total: number }): void {
        this.lastSentAt = this.now();
        this.sendProgress(progress.completed, progress.total);
    }
}