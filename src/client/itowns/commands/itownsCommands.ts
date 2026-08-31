/**
 * IFrame 間コマンド名定数
 * itowns_command.js の TypeScript 移植
 */
export const ITownsCommand = {
    Init: 'Init',
    AddContent: 'AddContent',
    InitLayers: 'InitLayers',
    UpdateLayer: 'UpdateLayer',
    UpdateCamera: 'UpdateCamera',
    Resize: 'Resize',
    AddLayer: 'AddLayer',
    DeleteLayer: 'DeleteLayer',
    SelectLayer: 'SelectLayer',
    ChangeLayerOrder: 'ChangeLayerOrder',
    ChangeLayerProperty: 'ChangeLayerProperty',
    MeasurePerformance: 'MeasurePerformance',
    UpdateTime: 'UpdateTime',
    LayersInitialized: 'LayersInitialized',
    StepForce: 'StepForce',
    MeasurePerformance2: 'MeasurePerformance2',
} as const;

export type ITownsCommandType = typeof ITownsCommand[keyof typeof ITownsCommand];
