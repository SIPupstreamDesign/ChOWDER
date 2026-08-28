class C3DTileUtil {
	static applyConvertSetting(layer, config) {
		if (config.conversion.src !== 'EPSG:4978' || config.conversion.dst !== 'EPSG:4978') {

			let srcEPSG = config.conversion.src;
			let dstEPSG = config.conversion.dst;

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
			
				// bbox変換関数
				let convertBoudningBox = (bbox) => {
					const vers = [
						new itowns.THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
						new itowns.THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
						new itowns.THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
						new itowns.THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
						new itowns.THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
						new itowns.THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
						new itowns.THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
						new itowns.THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z)
					];
					for (let i = 0; i < vers.length; ++i) {
						const p = new itowns.Coordinates(
							srcEPSG,
							vers[i].x, vers[i].y, vers[i].z
						).as(dstEPSG);
						vers[i].x = p.x;
						vers[i].y = p.y;
						vers[i].z = p.z;
					}
					bbox.makeEmpty();
					for (let i = 0; i < vers.length; ++i) {
						bbox.expandByPoint(vers[i]);
					}
				}

				// 全タイルセットのboudingVlumeを変換
				if (layer.tileset.hasOwnProperty('tiles')) {
					for (let i = 0; i < layer.tileset.tiles.length; ++i) {
						const tile = layer.tileset.tiles[i];
						if (tile.boundingVolume.hasOwnProperty('box')) {
							convertBoudningBox(tile.boundingVolume.box);
						}
					}
				}

				layer.object3d.traverse(obj => {
					// meshがあった場合
					if (obj.type === 'Mesh') {
						// bboxを一旦初期化する
						if (isInitial && layer.root.hasOwnProperty('boundingVolume')) {
							if (layer.root.boundingVolume.hasOwnProperty('box')) {
								layer.root.boundingVolume.box.makeEmpty();
							}
							isInitial = false;
						}
						const attrs = obj.geometry.attributes;
						const positions = attrs.position;
						// 頂点座標の変換
						for (let i = 0; i < positions.count; ++i) {
							const v0 = i * positions.itemSize + 0;
							const v1 = i * positions.itemSize + 1;
							const v2 = i * positions.itemSize + 2;
							const p = new itowns.Coordinates(
								srcEPSG,
								positions.array[v0], positions.array[v1], positions.array[v2]
							).as(dstEPSG);

							positions.array[v0] = p.x;
							positions.array[v1] = p.y;
							positions.array[v2] = p.z;
						}
						attrs.position.needsUpdate = true;

						// 法線再計算
						obj.geometry.computeVertexNormals();
						// bbox再計算
						obj.geometry.computeBoundingBox();
						// meshのbboxをlayerのboundingVolume.boxにunionしていく
						if (obj.layer.root.hasOwnProperty('boundingVolume')) {
							if (obj.layer.root.boundingVolume.hasOwnProperty('box')) {
								obj.layer.root.boundingVolume.box.union(obj.geometry.boundingBox);
							}
						}
					}
				});
				
				layer.onTileContentLoaded = (tile) => {
					tile.traverse(obj => {
						// meshがあった場合
						if (obj.type === 'Mesh') {
							// bboxを一旦初期化する
							if (isInitial && layer.root.hasOwnProperty('boundingVolume')) {
								if (layer.root.boundingVolume.hasOwnProperty('box')) {
									layer.root.boundingVolume.box.makeEmpty();
								}
								isInitial = false;
							}
							const attrs = obj.geometry.attributes;
							const positions = attrs.position;
							// 頂点座標の変換
							for (let i = 0; i < positions.count; ++i) {
								const v0 = i * positions.itemSize + 0;
								const v1 = i * positions.itemSize + 1;
								const v2 = i * positions.itemSize + 2;
								const p = new itowns.Coordinates(
									srcEPSG,
									positions.array[v0], positions.array[v1], positions.array[v2]
								).as(dstEPSG);

								positions.array[v0] = p.x;
								positions.array[v1] = p.y;
								positions.array[v2] = p.z;
							}
							attrs.position.needsUpdate = true;

							// 法線再計算
							obj.geometry.computeVertexNormals();
							// bbox再計算
							obj.geometry.computeBoundingBox();
							// meshのbboxをlayerのboundingVolume.boxにunionしていく
							if (obj.layer.root.hasOwnProperty('boundingVolume')) {
								if (obj.layer.root.boundingVolume.hasOwnProperty('box')) {
									obj.layer.root.boundingVolume.box.union(obj.geometry.boundingBox);
								}
							}
						}
					});
				};

			});
		}
	}
}
export default C3DTileUtil;
