// geotiffの書き出しあたりでメモリバカ食いするので
//  node --max-old-space-size=32000 .\himawari_parse_test.js
// という感じでヒープサイズ指定して実行すること.

const fs = require('fs');
const path = require('path');

const GeoTIFF = require('./geotiff.js/dist/geotiff.bundle.js');

const AmaterassParser = require('./amaterass_parser.js').AmaterassParser;

if (process.argv.length < 3) {
    console.log('Error: Not found argument of amaterass data file');
    console.log('Usage: node --max-old-space-size=32000 ./amaterass_parse_test.js amaterassDataAbsolutePath');
    process.exit();
}
const targetFile = process.argv[process.argv.length - 1];
console.log('targetFile absolute path:', targetFile);

function parseTest(targetFile)
{
	const width = 3000;
	const height = 3000;
	const file = targetFile;//'D:/data/himawaridata/201910100020.wtr.cld.cth.fld.4km.bin'

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

parseTest(targetFile);