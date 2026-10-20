import { isCameraRevision, isNewerCamera, type CameraRevision } from '../../common/cameraState';
import type { IFrameConnector } from './IFrameConnector';

export interface CameraEnvelope extends CameraRevision {
    sourceUrl?: string;
    metadataId: string;
    cameraWorldMatrix: string;
    cameraParams: string;
    diagnosticId?: string;
    diagnosticSessionId?: string;
}

export class CameraMirrorUpdates {
    private readonly states = new Map<string, CameraEnvelope>();
    private readonly minimumGenerations = new Map<string, number>();

    remember(value: unknown): boolean {
        if (!isCameraRevision(value) || !('metadataId' in value) || typeof value.metadataId !== 'string'
            || !('cameraWorldMatrix' in value) || typeof value.cameraWorldMatrix !== 'string'
            || !('cameraParams' in value) || typeof value.cameraParams !== 'string') {
            return false;
        }
        const next = value as CameraEnvelope;
        if (next.generation < (this.minimumGenerations.get(next.metadataId) ?? 0)
            || !isNewerCamera(next, this.states.get(next.metadataId) ?? null)) {
            return false;
        }
        this.states.set(next.metadataId, { ...next });
        return true;
    }

    send(connector: IFrameConnector, metadataId: string, onReply?: (error: unknown, result?: unknown) => void): void {
        const state = this.states.get(metadataId);
        if (state === undefined) {
            return;
        }
        try {
            connector.send('UpdateCamera', {
                ...state,
                mat: JSON.parse(state.cameraWorldMatrix),
                params: JSON.parse(state.cameraParams),
            }, onReply ?? null);
        } catch (error: unknown) {
            onReply?.(error);
        }
    }

    restore(connector: IFrameConnector, value: CameraEnvelope): void {
        this.remember(value);
        this.send(connector, value.metadataId);
    }

    forget(metadataId: string): void {
        const previous = this.states.get(metadataId);
        if (previous !== undefined) {
            this.minimumGenerations.set(metadataId, previous.generation + 1);
        }
        this.states.delete(metadataId);
    }

    invalidateUrl(metadataId: string, url: string): void {
        const previous = this.states.get(metadataId);
        if (previous !== undefined && previous.sourceUrl !== url) {
            this.forget(metadataId);
        }
    }
}

export const cameraMirrorUpdates = new CameraMirrorUpdates();