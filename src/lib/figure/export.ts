// Figure export: vector (SVG, PDF) and raster (PNG, TIFF) with correct
// physical size and resolution metadata, so a journal's checks read the dpi
// the file was rendered at rather than a default 72 or 96.

import type { FontFamily } from './settings.svelte';
import { FONT_STACK, PDF_FONT } from './theme';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Largest canvas Chromium, Firefox and Safari all accept. */
const MAX_SIDE = 16384;
const MAX_AREA = 268_000_000;

export interface ExportSize {
	widthPt: number;
	heightPt: number;
}

export function download(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sized(svg: SVGSVGElement, width: string, height: string): SVGSVGElement {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('xmlns', SVG_NS);
	clone.setAttribute('version', '1.1');
	clone.setAttribute('width', width);
	clone.setAttribute('height', height);
	clone.removeAttribute('class');
	clone.removeAttribute('style');
	return clone;
}

const mm = (pt: number) => `${(pt / (72 / 25.4)).toFixed(3)}mm`;

/** Standalone SVG at the printed size in millimetres. */
export function svgMarkup(svg: SVGSVGElement, size: ExportSize): string {
	const clone = sized(svg, mm(size.widthPt), mm(size.heightPt));
	return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${new XMLSerializer().serializeToString(clone)}\n`;
}

export function exportSvg(svg: SVGSVGElement, size: ExportSize, filename: string): void {
	download(new Blob([svgMarkup(svg, size)], { type: 'image/svg+xml' }), filename);
}

export function pixelSize(size: ExportSize, dpi: number) {
	const width = Math.round((size.widthPt / 72) * dpi);
	const height = Math.round((size.heightPt / 72) * dpi);
	const fits = width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_AREA;
	return { width, height, fits };
}

async function rasterize(
	svg: SVGSVGElement,
	size: ExportSize,
	dpi: number,
	transparent: boolean
): Promise<HTMLCanvasElement> {
	const px = pixelSize(size, dpi);
	if (!px.fits) {
		throw new Error(
			`${px.width} × ${px.height} px exceeds what a browser canvas can hold; lower the dpi or use PDF/SVG.`
		);
	}
	// Rasterise the vector at the target resolution, not an upscaled bitmap.
	const markup = new XMLSerializer().serializeToString(sized(svg, `${px.width}`, `${px.height}`));
	const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
	try {
		const img = new Image();
		img.decoding = 'sync';
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('the figure could not be rasterised'));
			img.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = px.width;
		canvas.height = px.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('canvas 2D context unavailable');
		if (!transparent) {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, px.width, px.height);
		}
		ctx.drawImage(img, 0, 0, px.width, px.height);
		return canvas;
	} finally {
		URL.revokeObjectURL(url);
	}
}

// -- PNG --------------------------------------------------------------------

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

/** Insert a pHYs chunk (pixels per metre) right after IHDR. */
function withDpi(png: Uint8Array, dpi: number): Uint8Array {
	const ppm = Math.round(dpi / 0.0254);
	const chunk = new Uint8Array(21);
	const view = new DataView(chunk.buffer);
	view.setUint32(0, 9);
	chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
	view.setUint32(8, ppm);
	view.setUint32(12, ppm);
	chunk[16] = 1; // unit: metre
	view.setUint32(17, crc32(chunk.subarray(4, 17)));
	const ihdrEnd = 8 + 4 + 4 + 13 + 4;
	const out = new Uint8Array(png.length + chunk.length);
	out.set(png.subarray(0, ihdrEnd), 0);
	out.set(chunk, ihdrEnd);
	out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
	return out;
}

export async function exportPng(
	svg: SVGSVGElement,
	size: ExportSize,
	dpi: number,
	transparent: boolean,
	filename: string
): Promise<void> {
	const canvas = await rasterize(svg, size, dpi, transparent);
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png')
	);
	const png = withDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
	download(new Blob([png as BlobPart], { type: 'image/png' }), filename);
}

// -- TIFF -------------------------------------------------------------------

/** PackBits, row by row (TIFF compression 32773). */
function packBits(row: Uint8Array, out: number[]): void {
	let i = 0;
	while (i < row.length) {
		let run = 1;
		while (i + run < row.length && run < 128 && row[i + run] === row[i]) run++;
		if (run > 1) {
			out.push(257 - run, row[i]);
			i += run;
			continue;
		}
		let lit = 1;
		while (
			i + lit < row.length &&
			lit < 128 &&
			!(i + lit + 1 < row.length && row[i + lit] === row[i + lit + 1])
		)
			lit++;
		out.push(lit - 1);
		for (let k = 0; k < lit; k++) out.push(row[i + k]);
		i += lit;
	}
}

/** Baseline RGB TIFF with X/YResolution in dots per inch. */
function encodeTiff(
	rgba: Uint8ClampedArray,
	width: number,
	height: number,
	dpi: number
): Uint8Array {
	const strips: Uint8Array[] = [];
	const row = new Uint8Array(width * 3);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const s = (y * width + x) * 4;
			const a = rgba[s + 3] / 255;
			// Flatten onto white: TIFF here is always opaque.
			row[x * 3] = Math.round(rgba[s] * a + 255 * (1 - a));
			row[x * 3 + 1] = Math.round(rgba[s + 1] * a + 255 * (1 - a));
			row[x * 3 + 2] = Math.round(rgba[s + 2] * a + 255 * (1 - a));
		}
		const packed: number[] = [];
		packBits(row, packed);
		strips.push(Uint8Array.from(packed));
	}
	const dataLength = strips.reduce((n, s) => n + s.length, 0);

	const entries = 13;
	const ifdSize = 2 + entries * 12 + 4;
	const bitsOffset = 8 + ifdSize;
	const xResOffset = bitsOffset + 6;
	const yResOffset = xResOffset + 8;
	const dataOffset = yResOffset + 8;
	const buf = new Uint8Array(dataOffset + dataLength);
	const v = new DataView(buf.buffer);
	buf.set([0x49, 0x49], 0); // little endian
	v.setUint16(2, 42, true);
	v.setUint32(4, 8, true);

	let p = 8;
	v.setUint16(p, entries, true);
	p += 2;
	const entry = (tag: number, type: number, count: number, value: number) => {
		v.setUint16(p, tag, true);
		v.setUint16(p + 2, type, true);
		v.setUint32(p + 4, count, true);
		if (type === 3 && count === 1) v.setUint16(p + 8, value, true);
		else v.setUint32(p + 8, value, true);
		p += 12;
	};
	const SHORT = 3;
	const LONG = 4;
	const RATIONAL = 5;
	entry(256, LONG, 1, width);
	entry(257, LONG, 1, height);
	entry(258, SHORT, 3, bitsOffset);
	entry(259, SHORT, 1, 32773); // PackBits
	entry(262, SHORT, 1, 2); // RGB
	entry(273, LONG, 1, dataOffset);
	entry(277, SHORT, 1, 3);
	entry(278, LONG, 1, height);
	entry(279, LONG, 1, dataLength);
	entry(282, RATIONAL, 1, xResOffset);
	entry(283, RATIONAL, 1, yResOffset);
	entry(284, SHORT, 1, 1); // chunky
	entry(296, SHORT, 1, 2); // inch
	v.setUint32(p, 0, true);

	v.setUint16(bitsOffset, 8, true);
	v.setUint16(bitsOffset + 2, 8, true);
	v.setUint16(bitsOffset + 4, 8, true);
	v.setUint32(xResOffset, dpi, true);
	v.setUint32(xResOffset + 4, 1, true);
	v.setUint32(yResOffset, dpi, true);
	v.setUint32(yResOffset + 4, 1, true);

	let offset = dataOffset;
	for (const strip of strips) {
		buf.set(strip, offset);
		offset += strip.length;
	}
	return buf;
}

export async function exportTiff(
	svg: SVGSVGElement,
	size: ExportSize,
	dpi: number,
	filename: string
): Promise<void> {
	const canvas = await rasterize(svg, size, dpi, false);
	const ctx = canvas.getContext('2d')!;
	const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const tiff = encodeTiff(data, canvas.width, canvas.height, dpi);
	download(new Blob([tiff as BlobPart], { type: 'image/tiff' }), filename);
}

// -- PDF --------------------------------------------------------------------

/** Vector PDF at the printed size, set in a standard-14 font so nothing is embedded. */
export async function exportPdf(
	svg: SVGSVGElement,
	size: ExportSize,
	font: FontFamily,
	title: string,
	filename: string
): Promise<void> {
	const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
	const clone = sized(svg, `${size.widthPt}`, `${size.heightPt}`);
	const stack = FONT_STACK[font];
	for (const el of [clone, ...clone.querySelectorAll('[font-family]')]) {
		if (el.getAttribute('font-family') === stack || el === clone) {
			el.setAttribute('font-family', PDF_FONT[font]);
		}
	}
	// svg2pdf measures through the DOM, so the clone must be attached.
	const host = document.createElement('div');
	host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden';
	host.appendChild(clone);
	document.body.appendChild(host);
	try {
		const landscape = size.widthPt > size.heightPt;
		const doc = new jsPDF({
			unit: 'pt',
			format: [size.widthPt, size.heightPt],
			orientation: landscape ? 'landscape' : 'portrait',
			compress: true
		});
		doc.setProperties({ title, creator: 'Biorefinery repository (biorepo)' });
		await doc.svg(clone, { x: 0, y: 0, width: size.widthPt, height: size.heightPt });
		doc.save(filename);
	} finally {
		host.remove();
	}
}
