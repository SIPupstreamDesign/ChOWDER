
'use strict';
const fs = require('fs');
const path = require('path');

class AmaterassParser {
	constructor(width_, height_) {
		this.width = width_;
		this.height = height_;
		this.data = []
	}

	parse(file) {
		return new Promise((resolve, reject) => {
			try {
				fs.open(file, 'r', (err, fd) => {
					if (err) { throw err; }

					this._parse(fd, 0).then((result) => {
						fs.close(fd, (err) => {
							if (err) { throw err; }
							resolve();
						});
					}).catch((err) => {
						reject(err);
					});
				})
			} catch (err) {
				reject(err);
			}
		});
	}

	_parse(fd, start) {
		return new Promise((resolve, reject) => {
			let linePromises = [];
			for (let i = 0; i < this.height; ++i) {
				linePromises.push(this._parseLine(fd, i * this.width * 4));
			}

			Promise.all(linePromises).then(resolve).catch((err) => {
				console.error(err);
			})
		});
	}

	_parseLine(fd, start) {
		return new Promise((resolve, reject) => {
			let bytes = 0;
			let buffer = Buffer.alloc(this.width * 4);
			fs.read(fd, buffer, 0, this.width * 4, start, (err, bytesRead, buf) => {
				if (err) {
					console.error(start, err);
					reject(err);
				}

				bytes += bytesRead;

				if (bytes === this.width * 4) {
					try {
						if (this._parseLineValues(buf, fd, start, resolve) !== false) {
							resolve(start);
						}
					} catch (err) {
						console.error(err);
						reject(err);
					}
				}
			});
		});
	}

	_readFloat(buf) {
		return buf.readFloatBE();
	}

	_parseLineValues(buf, fd = null, start = -1, resolve = null) {
		for (let i = 0; i < this.width * 4; i += 4) {
			const val = this._readFloat(buf.slice(i, i + 4));
			this.data[(start + i) / 4] = val;
		}
	}

	getBuffer() {
		return this.buffer;
	}
}


/// Amaterassデータの変換用クラス
class AmaterassConverter {
    constructor(width, height, amaterassData) {
		this.amaterass = amaterassData;
		this.width = width;
		this.height = height;
	}

}

AmaterassConverter.convertPixelToLonLat = (width, height, x, y) =>
{
	const lonPerPixel = 120 / height;
	const latPerPixel = 120 / width;

	let lat = (120 - y * lonPerPixel) - 60.0; // +60.0(南緯) ~ -60.0(北緯)
	let lon = x * latPerPixel + 85;
	if (lon > 180) {
		lon = lon - 180 * 2;
	}  // +85.0(東経) ~ 180.0(日付変更線) ~ -155.0(西経)

	return {
		lon : lon,
		lat : lat
	}
}

module.exports = {
	AmaterassParser: AmaterassParser,
	AmaterassConverter : AmaterassConverter
};
