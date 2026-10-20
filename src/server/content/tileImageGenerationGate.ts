import type { TileImageUploadDescriptor } from './tileImageService';

export type TileImageUploadPhase = 'creating' | 'receiving' | 'processing' | 'cancelled';

export interface TileImageUploadReservation {
    uploadId: string;
    metadataId: string | null;
    socketId: string;
    userId: string;
    descriptor: TileImageUploadDescriptor;
    phase: TileImageUploadPhase;
}

export interface TileImageUploadCancellation {
    reservation: TileImageUploadReservation;
    cleanupAfterMetadataCreate: boolean;
}

export class TileImageGenerationGate {
    private activeReservation: TileImageUploadReservation | null = null;

    tryReserve(
        descriptor: TileImageUploadDescriptor,
        socketId: string,
        userId: string,
    ): boolean {
        if (this.activeReservation !== null) {
            return false;
        }

        this.activeReservation = {
            uploadId: descriptor.uploadId,
            metadataId: null,
            socketId,
            userId,
            descriptor: { ...descriptor },
            phase: 'creating',
        };
        return true;
    }

    bindMetadata(uploadId: string, socketId: string, metadataId: string): boolean {
        const reservation = this.activeReservation;
        if (reservation === null || reservation.uploadId !== uploadId || reservation.socketId !== socketId) {
            return false;
        }

        reservation.metadataId = metadataId;
        if (reservation.phase === 'cancelled') {
            return false;
        }
        if (reservation.phase !== 'creating') {
            return false;
        }

        reservation.phase = 'receiving';
        return true;
    }

    getReservationForSocket(socketId: string): TileImageUploadReservation | null {
        const reservation = this.activeReservation;
        if (reservation === null || reservation.socketId !== socketId) {
            return null;
        }
        return { ...reservation, descriptor: { ...reservation.descriptor } };
    }

    markProcessing(uploadId: string, socketId: string): boolean {
        const reservation = this.activeReservation;
        if (
            reservation === null
            || reservation.uploadId !== uploadId
            || reservation.socketId !== socketId
            || reservation.phase !== 'receiving'
        ) {
            return false;
        }
        reservation.phase = 'processing';
        return true;
    }

    isProcessing(uploadId: string, socketId: string): boolean {
        return this.activeReservation?.uploadId === uploadId
            && this.activeReservation.socketId === socketId
            && this.activeReservation.phase === 'processing';
    }

    cancelForSocket(socketId: string): TileImageUploadCancellation | null {
        const reservation = this.activeReservation;
        if (reservation === null || reservation.socketId !== socketId) {
            return null;
        }
        if (reservation.phase === 'processing' || reservation.phase === 'cancelled') {
            return null;
        }
        if (reservation.phase === 'creating') {
            reservation.phase = 'cancelled';
            this.activeReservation = null;
            return {
                reservation: { ...reservation, descriptor: { ...reservation.descriptor } },
                cleanupAfterMetadataCreate: true,
            };
        }

        this.activeReservation = null;
        return {
            reservation: { ...reservation, descriptor: { ...reservation.descriptor } },
            cleanupAfterMetadataCreate: false,
        };
    }

    release(uploadId: string, socketId: string): TileImageUploadReservation | null {
        const reservation = this.activeReservation;
        if (reservation === null || reservation.uploadId !== uploadId || reservation.socketId !== socketId) {
            return null;
        }
        this.activeReservation = null;
        return { ...reservation, descriptor: { ...reservation.descriptor } };
    }
}