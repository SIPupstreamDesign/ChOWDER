/**
 * レイヤー種別定数
 * itowns_constants.js の TypeScript 移植
 */
export const ITownsConstants = {
    UploadTypeCSV: 'itownsapp_csv',
    UploadTypeJSON: 'itownsapp_json',
    TypeColor: 'color',
    TypeElevation: 'elevation',
    Type3DTile: '3dtile',
    TypePointCloud: 'pointcloud',
    TypeGeometry: 'geometry',
    TypeUser: 'user',
    TypeGlobe: 'globe',
    TypeAtomosphere: 'atomosphere',
    TypeBargraph: 'bargraph',        // 独自拡張
    TypeOBJ: 'obj',                  // 独自拡張
    TypePointCloudTimeSeries: 'pointcloud_timeseries', // 独自拡張
    Type3DTilesTimeSeries: '3dtiles_timeseries',       // 独自拡張
} as const;

export type ITownsConstantType = typeof ITownsConstants[keyof typeof ITownsConstants];
