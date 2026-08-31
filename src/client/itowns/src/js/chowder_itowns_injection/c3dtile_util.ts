/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */

export class C3DTileUtil {
    static applyConvertSetting(layer: any, config: any): void {
        if (config.conversion.src === 'EPSG:4978' && config.conversion.dst === 'EPSG:4978') return;

        let srcEPSG: string = config.conversion.src;
        let dstEPSG: string = config.conversion.dst;

        if (srcEPSG === 'Custom') {
            srcEPSG = config.conversion.srcCustomEPSG;
            itowns.proj4.defs(srcEPSG, config.conversion.srcCustomProj4);
            console.log('set proj4 definition', srcEPSG, config.conversion.srcCustomProj4);
        }
        if (dstEPSG === 'Custom') {
            dstEPSG = config.conversion.dstCustomEPSG;
            itowns.proj4.defs(dstEPSG, config.conversion.dstCustomProj4);
            console.log('set proj4 definition', dstEPSG, config.conversion.dstCustomProj4);
        }
        console.log('srcEPSG/dstEPSG', srcEPSG, '/', dstEPSG);

        layer.whenReady.then(() => {
            let isInitial = true;

            const convertBoundingBox = (bbox: any) => {
                const vers = [
                    new itowns.THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
                    new itowns.THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
                    new itowns.THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
                    new itowns.THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
                    new itowns.THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
                    new itowns.THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
                    new itowns.THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
                    new itowns.THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
                ];
                for (const ver of vers) {
                    const p = new itowns.Coordinates(srcEPSG, ver.x, ver.y, ver.z).as(dstEPSG);
                    ver.x = p.x; ver.y = p.y; ver.z = p.z;
                }
                bbox.makeEmpty();
                for (const ver of vers) bbox.expandByPoint(ver);
            };

            if (layer.tileset?.tiles) {
                for (const tile of layer.tileset.tiles) {
                    if (tile.boundingVolume?.box) convertBoundingBox(tile.boundingVolume.box);
                }
            }

            layer.object3d.traverse((obj: any) => {
                if (obj.type === 'Mesh') {
                    if (isInitial && layer.root?.boundingVolume?.box) {
                        layer.root.boundingVolume.box.makeEmpty();
                        isInitial = false;
                    }
                    const positions = obj.geometry.attributes.position;
                    for (let i = 0; i < positions.count; ++i) {
                        const v0 = i * positions.itemSize;
                        const p = new itowns.Coordinates(srcEPSG, positions.array[v0], positions.array[v0 + 1], positions.array[v0 + 2]).as(dstEPSG);
                        positions.array[v0] = p.x;
                        positions.array[v0 + 1] = p.y;
                        positions.array[v0 + 2] = p.z;
                    }
                    positions.needsUpdate = true;
                    obj.geometry.computeVertexNormals();
                    obj.geometry.computeBoundingBox();
                    if (obj.layer.root?.boundingVolume?.box) {
                        obj.layer.root.boundingVolume.box.union(obj.geometry.boundingBox);
                    }
                }
            });

            layer.onTileContentLoaded = (tile: any) => {
                tile.traverse((obj: any) => {
                    if (obj.type === 'Mesh') {
                        if (isInitial && layer.root?.boundingVolume?.box) {
                            layer.root.boundingVolume.box.makeEmpty();
                            isInitial = false;
                        }
                        const positions = obj.geometry.attributes.position;
                        for (let i = 0; i < positions.count; ++i) {
                            const v0 = i * positions.itemSize;
                            const p = new itowns.Coordinates(srcEPSG, positions.array[v0], positions.array[v0 + 1], positions.array[v0 + 2]).as(dstEPSG);
                            positions.array[v0] = p.x;
                            positions.array[v0 + 1] = p.y;
                            positions.array[v0 + 2] = p.z;
                        }
                        positions.needsUpdate = true;
                        obj.geometry.computeVertexNormals();
                        obj.geometry.computeBoundingBox();
                        if (obj.layer.root?.boundingVolume?.box) {
                            obj.layer.root.boundingVolume.box.union(obj.geometry.boundingBox);
                        }
                    }
                });
            };
        });
    }
}
