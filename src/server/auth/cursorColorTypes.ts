export type CursorColorHex = `#${string}`;

export interface CursorColorCandidate {
    hue: number;
    color: CursorColorHex;
}

export interface CursorColorAllocationInput {
    usedColors: string[];
    candidates?: CursorColorCandidate[];
}
