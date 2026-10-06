import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClientDiagnosticLogService } from './clientDiagnosticLogService';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chowder-diagnostic-'));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(async (): Promise<void> => {
    await Promise.all(temporaryDirectories.map(async (directory): Promise<void> => {
        await fs.rm(directory, { recursive: true, force: true });
    }));
    temporaryDirectories.length = 0;
});

describe('ClientDiagnosticLogService', () => {
    it('does not write files while diagnostics are disabled', async (): Promise<void> => {
        const directory = await createTemporaryDirectory();
        const service = new ClientDiagnosticLogService({ enabled: false, directory });

        service.append({ event: 'display-layout' });
        await service.flush();

        assert.deepStrictEqual(await fs.readdir(directory), []);
    });

    it('continues accepting events while diagnostics remain enabled', async (): Promise<void> => {
        const directory = await createTemporaryDirectory();
        const service = new ClientDiagnosticLogService({
            enabled: true,
            directory,
        });

        assert.strictEqual(service.isActive(), true);
        assert.strictEqual(service.append({ event: 'display-layout' }), true);
        await service.flush();
        assert.strictEqual((await fs.readdir(directory)).length, 1);
    });

    it('writes one JSON record with server session and receive time', async (): Promise<void> => {
        const directory = await createTemporaryDirectory();
        const service = new ClientDiagnosticLogService({ enabled: true, directory });

        service.append({ event: 'display-layout', value: 42 });
        await service.flush();

        const fileNames = await fs.readdir(directory);
        assert.strictEqual(fileNames.length, 1);
        const lines = (await fs.readFile(path.join(directory, fileNames[0]), 'utf8')).trim().split('\n');
        const record = JSON.parse(lines[0]);
        assert.strictEqual(record.event, 'display-layout');
        assert.strictEqual(record.value, 42);
        assert.strictEqual(record.diagnosticSessionId, service.sessionId);
        assert.match(record.serverReceivedAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.match(fileNames[0], new RegExp(`^client-diagnostic-\\d{4}-\\d{2}-\\d{2}-${service.sessionId}-0001\\.jsonl$`));
    });

    it('writes separate files for separate diagnostic sessions', { timeout: 5000 }, async (): Promise<void> => {
        const directory = await createTemporaryDirectory();
        const firstService = new ClientDiagnosticLogService({ enabled: true, directory });
        const secondService = new ClientDiagnosticLogService({ enabled: true, directory });

        firstService.append({ event: 'first-session' });
        secondService.append({ event: 'second-session' });
        await Promise.all([firstService.flush(), secondService.flush()]);

        const fileNames = await fs.readdir(directory);
        assert.strictEqual(fileNames.length, 2);
        assert.notStrictEqual(firstService.sessionId, secondService.sessionId);
        assert.strictEqual(fileNames.filter((fileName) => fileName.includes(`-${firstService.sessionId}-`)).length, 1);
        assert.strictEqual(fileNames.filter((fileName) => fileName.includes(`-${secondService.sessionId}-`)).length, 1);

        const firstFileName = fileNames.find((fileName) => fileName.includes(`-${firstService.sessionId}-`));
        const secondFileName = fileNames.find((fileName) => fileName.includes(`-${secondService.sessionId}-`));
        assert.ok(firstFileName !== undefined);
        assert.ok(secondFileName !== undefined);
        assert.match(await fs.readFile(path.join(directory, firstFileName), 'utf8'), /first-session/);
        assert.match(await fs.readFile(path.join(directory, secondFileName), 'utf8'), /second-session/);
    });

    it('rotates files within the same session when the configured file size is reached', { timeout: 5000 }, async (): Promise<void> => {
        const directory = await createTemporaryDirectory();
        const service = new ClientDiagnosticLogService({
            enabled: true,
            directory,
            maxFileBytes: 100,
        });

        service.append({ event: 'display-layout', value: 'first-record' });
        service.append({ event: 'display-layout', value: 'second-record' });
        await service.flush();

        const fileNames = await fs.readdir(directory);
        assert.strictEqual(fileNames.length, 2);
        assert.ok(service.sessionId !== null);
        assert.deepStrictEqual(fileNames.sort(), [
            `client-diagnostic-${new Date().toISOString().slice(0, 10)}-${service.sessionId}-0001.jsonl`,
            `client-diagnostic-${new Date().toISOString().slice(0, 10)}-${service.sessionId}-0002.jsonl`,
        ]);
    });

    it('removes expired files in both legacy and session-based formats', { timeout: 5000 }, async (): Promise<void> => {
        const directory = await createTemporaryDirectory();
        const expiredLegacyFile = path.join(directory, 'client-diagnostic-2000-01-01-0001.jsonl');
        const expiredSessionFile = path.join(directory, 'client-diagnostic-2000-01-01-123e4567-e89b-12d3-a456-426614174000-0001.jsonl');
        const expiredTimestamp = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000;
        await Promise.all([
            fs.writeFile(expiredLegacyFile, '{}\n'),
            fs.writeFile(expiredSessionFile, '{}\n'),
        ]);
        await Promise.all([
            fs.utimes(expiredLegacyFile, expiredTimestamp, expiredTimestamp),
            fs.utimes(expiredSessionFile, expiredTimestamp, expiredTimestamp),
        ]);

        const service = new ClientDiagnosticLogService({ enabled: true, directory });
        service.append({ event: 'display-layout' });
        await service.flush();

        const fileNames = await fs.readdir(directory);
        assert.strictEqual(fileNames.includes(path.basename(expiredLegacyFile)), false);
        assert.strictEqual(fileNames.includes(path.basename(expiredSessionFile)), false);
    });
});