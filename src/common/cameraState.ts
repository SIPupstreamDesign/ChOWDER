export interface CameraRevision {
    generation: number;
    revision: number;
}

export interface CameraSourceLease {
    generation: number;
    sourceEpoch: number;
}

export interface CameraSourceUpdate extends CameraSourceLease {
    sourceInstanceId: string;
    sourceSequence: number;
    ownerSocketId: string;
}

export function isCameraRevision(value: unknown): value is CameraRevision {
    return typeof value === 'object' && value !== null
        && 'generation' in value && Number.isSafeInteger(value.generation) && Number(value.generation) > 0
        && 'revision' in value && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0;
}

export function isNewerCamera(next: CameraRevision, previous: CameraRevision | null): boolean {
    return previous === null || next.generation > previous.generation
        || (next.generation === previous.generation && next.revision > previous.revision);
}