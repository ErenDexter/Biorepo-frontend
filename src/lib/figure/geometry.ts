import type { EdgeStyle } from './settings.svelte';
import type { Point } from './layout';

const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (p: Point) => `${r2(p.x)} ${r2(p.y)}`;

function unit(from: Point, to: Point): Point {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const len = Math.hypot(dx, dy) || 1;
	return { x: dx / len, y: dy / len };
}

/**
 * The stroke path of an edge and the polygon of its arrowhead.
 *
 * Arrowheads are explicit polygons rather than SVG markers, which PDF
 * converters and vector editors handle inconsistently. The line stops inside
 * the head so the tip stays sharp.
 */
export function edgeShape(
	points: Point[],
	spline: boolean,
	style: EdgeStyle,
	arrowLength: number,
	arrowWidth: number,
	cornerRadius: number
): { d: string; arrow: string } {
	if (points.length < 2) return { d: '', arrow: '' };
	const end = points.at(-1)!;
	const before = points.at(-2)!;
	const dir = unit(before, end);
	const base = { x: end.x - dir.x * arrowLength, y: end.y - dir.y * arrowLength };
	const half = arrowWidth / 2;
	const arrow = [
		end,
		{ x: base.x - dir.y * half, y: base.y + dir.x * half },
		{ x: base.x + dir.y * half, y: base.y - dir.x * half }
	]
		.map(pt)
		.join(' ');

	const lastSegment = Math.hypot(end.x - before.x, end.y - before.y);
	const trim = Math.min(arrowLength * 0.8, lastSegment);
	const stop = { x: end.x - dir.x * trim, y: end.y - dir.y * trim };
	const pts = [...points.slice(0, -1), stop];

	if (spline) {
		let d = `M ${pt(pts[0])}`;
		for (let i = 1; i + 2 < pts.length; i += 3)
			d += ` C ${pt(pts[i])} ${pt(pts[i + 1])} ${pt(pts[i + 2])}`;
		return { d, arrow };
	}
	if (style !== 'rounded' || pts.length < 3) {
		return { d: `M ${pts.map(pt).join(' L ')}`, arrow };
	}
	let d = `M ${pt(pts[0])}`;
	for (let i = 1; i < pts.length - 1; i++) {
		const prev = pts[i - 1];
		const cur = pts[i];
		const next = pts[i + 1];
		const r = Math.min(
			cornerRadius,
			Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2,
			Math.hypot(next.x - cur.x, next.y - cur.y) / 2
		);
		const a = unit(cur, prev);
		const b = unit(cur, next);
		d += ` L ${pt({ x: cur.x + a.x * r, y: cur.y + a.y * r })}`;
		d += ` Q ${pt(cur)} ${pt({ x: cur.x + b.x * r, y: cur.y + b.y * r })}`;
	}
	d += ` L ${pt(pts.at(-1)!)}`;
	return { d, arrow };
}
