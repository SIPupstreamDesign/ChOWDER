// geotiffの書き出しあたりでメモリバカ食いするので
//  node --max-old-space-size=32000 .\himawari_parse_test.js
// という感じでヒープサイズ指定して実行すること.

const fs = require('fs');
const path = require('path');

const GeoTIFF = require('./geotiff.js/dist/geotiff.bundle.js');

const AmaterassParser = require('./amaterass_parser.js').AmaterassParser;

function parseTest()
{
	const width = 3000;
	const height = 3000;
	const file = 'D:/data/himawaridata/201910100020.wtr.cld.cth.fld.4km.bin'

	let parser = new AmaterassParser(width, height);
	parser.parse(file).then(
		async () => {
			const metadata = {
				width : width,
				height : height
			}
			
			let values = parser.data;
			let min = Infinity;
			let max = -Infinity;
			for (let i = 0; i < values.length; ++i) {
				min = Math.min(min, values[i]);
				max = Math.max(max, values[i]);
			}
			let range = max - min;
			for (let i = 0; i < values.length; ++i) {
				values[i] = values[i] / range * 0xFF;
			}
			const arrayBuffer = await GeoTIFF.writeArrayBuffer(values, metadata);
			fs.writeFileSync("output.tiff", Buffer.from(arrayBuffer));
		}
	).catch((err) => {
		console.error(err);
	})
}

parseTest();