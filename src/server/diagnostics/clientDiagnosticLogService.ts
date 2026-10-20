import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export type ClientDiagnosticRecord = Record<string, unknown>;

export interface ClientDiagnosticLogOptions {
    enabled?: boolean;
    directory?: string;
    maxFileBytes?: number;
    maxRecordBytes?: number;
    retentionDays?: number;
}

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_RECORD_BYTES = 16 * 1024;
const DEFAULT_RETENTION_DAYS = 7;

/** Writes opt-in client diagnostic events as bounded JSON Lines files. */
export class ClientDiagnosticLogService {
    readonly enabled: boolean;
    readonly sessionId: string | null;

    private readonly directory: string;
    private readonly maxFileBytes: number;
    private readonly maxRecordBytes: number;
    private readonly retentionDays: number;
    private writeQueue: Promise<void> = Promise.resolve();
    private writeErrorReported = false;
    private lastPrunedDate = '';

    constructor(options: ClientDiagnosticLogOptions = {}) {
        this.enabled = options.enabled ?? process.env.CLIENT_DIAGNOSTIC_ENABLED === 'true';
        this.sessionId = this.enabled ? randomUUID() : null;
        this.directory = options.directory ?? process.env.CLIENT_DIAGNOSTIC_LOG_DIR ?? path.join(process.cwd(), 'logs', 'client-diagnostics');
        this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
        this.maxRecordBytes = options.maxRecordBytes ?? DEFAULT_MAX_RECORD_BYTES;
        this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    }

    isActive(): boolean {
        return this.enabled && this.sessionId !== null;
    }

    append(record: ClientDiagnosticRecord): boolean {
        if (!this.isActive() || this.sessionId === null) {
            return false;
        }
        const sessionId = this.sessionId;

        let serialized: string;
        try {
            serialized = JSON.stringify({
                ...record,
                diagnosticSessionId: this.sessionId,
                serverReceivedAt: new Date().toISOString(),
            });
        } catch {
            return false;
        }
        if (Buffer.byteLength(serialized, 'utf8') > this.maxRecordBytes) {
            return false;
        }

        this.writeQueue = this.writeQueue
            .then(async (): Promise<void> => {
                await this.appendLine(`${serialized}\n`, sessionId);
            })
            .catch((error: unknown): void => {
                this.reportWriteError(error);
            });
        return true;
    }

    async flush(): Promise<void> {
        await this.writeQueue;
    }

    private async appendLine(line: string, sessionId: string): Promise<void> {
        await fs.mkdir(this.directory, { recursive: true });
        const date = new Date().toISOString().slice(0, 10);
        if (this.lastPrunedDate !== date) {
            await this.removeExpiredFiles(date);
            this.lastPrunedDate = date;
        }

        const filePath = await this.findWritableFile(date, sessionId, Buffer.byteLength(line, 'utf8'));
        await fs.appendFile(filePath, line, 'utf8');
    }

    private async findWritableFile(date: string, sessionId: string, recordBytes: number): Promise<string> {
        for (let sequence = 1; ; sequence += 1) {
            const suffix = String(sequence).padStart(4, '0');
            const filePath = path.join(this.directory, `client-diagnostic-${date}-${sessionId}-${suffix}.jsonl`);
            let fileSize = 0;
            try {
                const fileStat = await fs.stat(filePath);
                fileSize = fileStat.size;
            } catch (error: unknown) {
                if (!this.isMissingFileError(error)) {
                    throw error;
                }
            }

            if (fileSize + recordBytes <= this.maxFileBytes || fileSize === 0) {
                return filePath;
            }
        }
    }

    private async removeExpiredFiles(currentDate: string): Promise<void> {
        const cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
        const fileNames = await fs.readdir(this.directory);
        for (const fileName of fileNames) {
            if (!/^client-diagnostic-\d{4}-\d{2}-\d{2}-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)?\d{4}\.jsonl$/.test(fileName)) {
                continue;
            }

            const filePath = path.join(this.directory, fileName);
            const fileStat = await fs.stat(filePath);
            if (fileStat.mtimeMs < cutoffTime && fileName.slice(18, 28) !== currentDate) {
                await fs.unlink(filePath);
            }
        }
    }

    private isMissingFileError(error: unknown): boolean {
        return typeof error === 'object'
            && error !== null
            && 'code' in error
            && error.code === 'ENOENT';
    }

    private reportWriteError(error: unknown): void {
        if (this.writeErrorReported) {
            return;
        }
        this.writeErrorReported = true;
        console.error('[ClientDiagnosticLogService] Failed to write diagnostic log:', error);
    }
}