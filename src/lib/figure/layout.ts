// Publication layout of a P-graph with ELK's layered algorithm.
//
// Every coordinate is in points at natural size. Text, symbols and strokes
// scale with the font size; gaps scale with an absolute unit times the spacing
// setting, so a larger font really does print larger at a fixed column width.

import ELK, { type ElkExtendedEdge, type ElkNode, type ElkPort } from 'elkjs/lib/elk.bundled.js';
import type { GraphEdge, GraphNode } from '$lib/types';
import type { FigureSettings } from './settings.svelte';
import { LEGEND_ORDER, LEGEND_TEXT, type NodeKind } from './theme';
import { LINE_HEIGHT, blockSize, labelLines, type Line, type Measure } from './text';

// Created on first use: layout only runs in the browser, and constructing ELK
// during server rendering on Cloudflare Workers fails (it reaches for Node's
// worker threads).
let elk: InstanceType<typeof ELK> | null = null;

export interface Point {
	x: number;
	y: number;
}

export interface PlacedText {
	/** Anchor x: left edge for `start`, centre for `middle`. */
	x: number;
	/** Top of the text block. */
	y: number;
	anchor: 'start' | 'middle';
	lines: Line[];
	width: number;
	height: number;
}

export interface FigNode {
	id: string;
	kind: NodeKind;
	/** The symbol (P-graph) or box (block diagram), excluding outside labels. */
	x: number;
	y: number;
	w: number;
	h: number;
	label: PlacedText;
	source: GraphNode;
}

export interface FigEdge {
	id: string;
	source: string;
	target: string;
	points: Point[];
	/** Points are cubic Bezier control points rather than a polyline. */
	spline: boolean;
}

export interface LegendItem {
	kind: NodeKind;
	/** Symbol box. */
	x: number;
	y: number;
	w: number;
	h: number;
	text: PlacedText;
}

/** Elements drawn at full strength; everything else is greyed out. */
export interface Highlight {
	nodes: Set<string>;
	edges: Set<string>;
}

export interface FigureLayout {
	/** Size of the drawing itself, without margin. */
	width: number;
	height: number;
	nodes: FigNode[];
	edges: FigEdge[];
	legend: LegendItem[];
}

/** Absolute unit for gaps, in pt. */
const GAP_UNIT = 8;

export function metrics(s: FigureSettings) {
	const fs = s.fontSize;
	const g = GAP_UNIT * s.spacing;
	return {
		fs,
		/** P-graph material symbol diameter. */
		d: fs * 0.95,
		/** P-graph operating-unit bar thickness and minimum length. */
		bar: fs * 0.48,
		barMin: fs * 3.4,
		/** Distance between arcs meeting one bar. */
		portGap: fs * 1.15,
		padX: fs * 0.6,
		padY: fs * 0.34,
		labelGap: fs * 0.38,
		edgeWidth: Math.max(0.45, fs * 0.07),
		strokeWidth: Math.max(0.5, fs * 0.085),
		arrowLength: fs * 0.62,
		arrowWidth: fs * 0.44,
		cornerRadius: fs * 0.45,
		gap: {
			layer: g * 2.3,
			node: g * 1.6,
			edgeNode: g * 0.7,
			edge: g * 0.55
		}
	};
}

export function nodeKind(n: GraphNode, s: FigureSettings): NodeKind {
	if (n.type === 'operation') return 'operation';
	if (n.role === 'raw') return n.raw_origin === 'augmented' && s.markAugmented ? 'raw-aug' : 'raw';
	return n.role;
}

/** Longest-path depth from the sources, used only to give ELK a sensible model order. */
function depths(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
	const preds = new Map<string, string[]>();
	for (const e of edges) preds.set(e.target, [...(preds.get(e.target) ?? []), e.source]);
	const memo = new Map<string, number>();
	const visit = (id: string, stack: Set<string>): number => {
		const known = memo.get(id);
		if (known !== undefined) return known;
		if (stack.has(id)) return 0;
		stack.add(id);
		const depth = Math.max(-1, ...(preds.get(id) ?? []).map((p) => visit(p, stack))) + 1;
		stack.delete(id);
		memo.set(id, depth);
		return depth;
	};
	for (const n of nodes) visit(n.id, new Set());
	return memo;
}

export async function layoutFigure(
	nodes: GraphNode[],
	edges: GraphEdge[],
	s: FigureSettings,
	measure: Measure,
	annotations: Map<string, string> = new Map()
): Promise<FigureLayout> {
	const m = metrics(s);
	const vertical = s.direction === 'DOWN';
	const pgraph = s.notation === 'pgraph';
	const inSide = vertical ? 'NORTH' : 'WEST';
	const outSide = vertical ? 'SOUTH' : 'EAST';

	const depth = depths(nodes, edges);
	const ordered = [...nodes].sort(
		(a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0) || a.label.localeCompare(b.label)
	);
	const incoming = new Map<string, GraphEdge[]>();
	const outgoing = new Map<string, GraphEdge[]>();
	for (const e of edges) {
		incoming.set(e.target, [...(incoming.get(e.target) ?? []), e]);
		outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e]);
	}

	interface Spec {
		node: GraphNode;
		kind: NodeKind;
		lines: Line[];
		text: { width: number; height: number };
		w: number;
		h: number;
		/** Port id used by an edge at this node. */
		port: (edge: GraphEdge, end: 'source' | 'target') => string;
	}
	const specs = new Map<string, Spec>();
	const children: ElkNode[] = [];

	for (const n of ordered) {
		const isOp = n.type === 'operation';
		const kind = nodeKind(n, s);
		const lines = labelLines(n.label, isOp, s, annotations.get(n.id));
		const text = blockSize(lines, m.fs, s.font, measure);
		const ins = incoming.get(n.id) ?? [];
		const outs = outgoing.get(n.id) ?? [];
		const perEdgePorts: ElkPort[] = [
			...ins.map((e) => ({
				id: `${n.id}::${e.id}`,
				width: 0,
				height: 0,
				layoutOptions: { 'elk.port.side': inSide }
			})),
			...outs.map((e) => ({
				id: `${n.id}::${e.id}`,
				width: 0,
				height: 0,
				layoutOptions: { 'elk.port.side': outSide }
			}))
		];
		const perEdge = (e: GraphEdge) => `${n.id}::${e.id}`;

		let w: number;
		let h: number;
		let child: ElkNode;
		let port: Spec['port'] = perEdge;

		if (!pgraph) {
			// Block diagram: label inside, one port per arc spread along the side.
			const padX = isOp ? m.padX : Math.max(m.padX, (text.height + 2 * m.padY) * 0.42);
			w = text.width + 2 * padX;
			h = text.height + 2 * m.padY;
			child = {
				id: n.id,
				width: w,
				height: h,
				ports: perEdgePorts,
				layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' }
			};
		} else if (!isOp) {
			// P-graph material: a small symbol; every arc meets it at one point.
			w = h = m.d;
			const inPort = vertical ? { x: w / 2, y: 0 } : { x: 0, y: h / 2 };
			const outPort = vertical ? { x: w / 2, y: h } : { x: w, y: h / 2 };
			child = {
				id: n.id,
				width: w,
				height: h,
				ports: [
					{
						id: `${n.id}::in`,
						width: 0,
						height: 0,
						...inPort,
						layoutOptions: { 'elk.port.side': inSide }
					},
					{
						id: `${n.id}::out`,
						width: 0,
						height: 0,
						...outPort,
						layoutOptions: { 'elk.port.side': outSide }
					}
				],
				labels: [{ text: n.id, width: text.width, height: text.height }],
				layoutOptions: {
					'elk.portConstraints': 'FIXED_POS',
					'elk.nodeLabels.placement': vertical
						? 'OUTSIDE V_CENTER H_RIGHT'
						: 'OUTSIDE V_BOTTOM H_CENTER'
				}
			};
			port = (_e, end) => (end === 'target' ? `${n.id}::in` : `${n.id}::out`);
		} else {
			// P-graph operating unit: a bar, long enough to keep its arcs apart.
			const length = Math.max(m.barMin, (Math.max(ins.length, outs.length) + 1) * m.portGap);
			w = vertical ? length : m.bar;
			h = vertical ? m.bar : length;
			child = {
				id: n.id,
				width: w,
				height: h,
				ports: perEdgePorts,
				labels: [{ text: n.id, width: text.width, height: text.height }],
				layoutOptions: {
					'elk.portConstraints': 'FIXED_SIDE',
					'elk.nodeLabels.placement': vertical
						? 'OUTSIDE V_CENTER H_RIGHT'
						: 'OUTSIDE V_BOTTOM H_CENTER'
				}
			};
		}
		children.push(child);
		specs.set(n.id, { node: n, kind, lines, text, w, h, port });
	}

	const elkEdges: ElkExtendedEdge[] = edges
		.filter((e) => specs.has(e.source) && specs.has(e.target))
		.map((e) => ({
			id: e.id,
			sources: [specs.get(e.source)!.port(e, 'source')],
			targets: [specs.get(e.target)!.port(e, 'target')]
		}));

	const spline = s.edgeStyle === 'spline';
	elk ??= new ELK();
	const laid = await elk.layout({
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': s.direction,
			'elk.edgeRouting': spline ? 'SPLINES' : 'ORTHOGONAL',
			'elk.layered.edgeRouting.splines.mode': 'CONSERVATIVE',
			'elk.padding': '[top=0,left=0,bottom=0,right=0]',
			'elk.spacing.nodeNode': String(m.gap.node),
			'elk.layered.spacing.nodeNodeBetweenLayers': String(m.gap.layer),
			'elk.spacing.edgeNode': String(m.gap.edgeNode),
			'elk.layered.spacing.edgeNodeBetweenLayers': String(m.gap.edgeNode),
			'elk.spacing.edgeEdge': String(m.gap.edge),
			'elk.layered.spacing.edgeEdgeBetweenLayers': String(m.gap.edge),
			'elk.spacing.labelNode': String(m.labelGap),
			'elk.spacing.portPort': String(m.portGap * 0.6),
			'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
			'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
			'elk.layered.thoroughness': '30',
			'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
			'elk.layered.unnecessaryBendpoints': 'false'
		},
		children,
		edges: elkEdges
	});

	const figNodes: FigNode[] = (laid.children ?? []).map((c) => {
		const spec = specs.get(c.id)!;
		const x = c.x ?? 0;
		const y = c.y ?? 0;
		const { text, lines } = spec;
		let label: PlacedText;
		if (!pgraph) {
			label = {
				x: x + spec.w / 2,
				y: y + (spec.h - text.height) / 2,
				anchor: 'middle',
				lines,
				...text
			};
		} else if (vertical) {
			label = {
				x: x + spec.w + m.labelGap,
				y: y + (spec.h - text.height) / 2,
				anchor: 'start',
				lines,
				...text
			};
		} else {
			label = { x: x + spec.w / 2, y: y + spec.h + m.labelGap, anchor: 'middle', lines, ...text };
		}
		return { id: c.id, kind: spec.kind, x, y, w: spec.w, h: spec.h, label, source: spec.node };
	});

	const byEdge = new Map(edges.map((e) => [e.id, e] as const));
	const figEdges: FigEdge[] = (laid.edges ?? []).flatMap((e) => {
		const section = e.sections?.[0];
		const original = byEdge.get(e.id);
		if (!section || !original) return [];
		const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(
			(p) => ({ x: p.x, y: p.y })
		);
		return [
			{
				id: e.id,
				source: original.source,
				target: original.target,
				points,
				spline: spline && (points.length - 4) % 3 === 0
			}
		];
	});

	const legend = s.legend ? layoutLegend(figNodes, figEdges, s, measure) : [];
	return normalise(figNodes, figEdges, legend);
}

function bounds(nodes: FigNode[], edges: FigEdge[]) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const add = (x0: number, y0: number, x1: number, y1: number) => {
		minX = Math.min(minX, x0);
		minY = Math.min(minY, y0);
		maxX = Math.max(maxX, x1);
		maxY = Math.max(maxY, y1);
	};
	for (const n of nodes) {
		add(n.x, n.y, n.x + n.w, n.y + n.h);
		const left = n.label.anchor === 'middle' ? n.label.x - n.label.width / 2 : n.label.x;
		add(left, n.label.y, left + n.label.width, n.label.y + n.label.height);
	}
	for (const e of edges) for (const p of e.points) add(p.x, p.y, p.x, p.y);
	if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
	return { minX, minY, maxX, maxY };
}

/** One row (wrapping if needed) of the symbols that actually occur, under the drawing. */
function layoutLegend(
	nodes: FigNode[],
	edges: FigEdge[],
	s: FigureSettings,
	measure: Measure
): LegendItem[] {
	const m = metrics(s);
	const present = new Set(nodes.map((n) => n.kind));
	const kinds = LEGEND_ORDER.filter((k) => present.has(k));
	if (kinds.length === 0) return [];

	const box = bounds(nodes, edges);
	const avail = Math.max(box.maxX - box.minX, m.fs * 20);
	const textGap = m.fs * 0.45;
	const itemGap = m.fs * 1.5;
	const rowHeight = m.fs * LINE_HEIGHT;
	const items = kinds.map((kind) => {
		const pg = s.notation === 'pgraph';
		const symbol =
			kind === 'operation'
				? pg
					? { w: m.fs * 2.2, h: m.bar }
					: { w: m.fs * 2.4, h: m.fs * 1.15 }
				: pg
					? { w: m.d, h: m.d }
					: { w: m.fs * 2.4, h: m.fs * 1.15 };
		const lines: Line[] = [{ text: LEGEND_TEXT[kind], italic: false, scale: 1 }];
		const text = blockSize(lines, m.fs, s.font, measure);
		return { kind, symbol, lines, text, width: symbol.w + textGap + text.width };
	});

	const pack = (limit: number) => {
		const rows: (typeof items)[] = [[]];
		let used = 0;
		for (const item of items) {
			const extra = (rows.at(-1)!.length ? itemGap : 0) + item.width;
			if (rows.at(-1)!.length && used + extra > limit) {
				rows.push([item]);
				used = item.width;
			} else {
				rows.at(-1)!.push(item);
				used += extra;
			}
		}
		return rows;
	};
	// As few rows as the drawing's width allows, then as even as possible.
	let rows = pack(avail);
	if (rows.length > 1) {
		const total = items.reduce((sum, i) => sum + i.width + itemGap, -itemGap);
		for (let limit = total / rows.length; limit < avail; limit += m.fs) {
			const balanced = pack(limit);
			if (balanced.length <= rows.length) {
				rows = balanced;
				break;
			}
		}
	}

	const out: LegendItem[] = [];
	let top = box.maxY + m.fs * 1.6;
	for (const row of rows) {
		const height = Math.max(rowHeight, ...row.map((i) => i.symbol.h));
		const total = row.reduce((sum, i, k) => sum + i.width + (k ? itemGap : 0), 0);
		let x = box.minX + (box.maxX - box.minX - total) / 2;
		const cy = top + height / 2;
		for (const item of row) {
			out.push({
				kind: item.kind,
				x,
				y: cy - item.symbol.h / 2,
				w: item.symbol.w,
				h: item.symbol.h,
				text: {
					x: x + item.symbol.w + textGap,
					y: cy - item.text.height / 2,
					anchor: 'start',
					lines: item.lines,
					...item.text
				}
			});
			x += item.width + itemGap;
		}
		top += height + m.fs * 0.5;
	}
	return out;
}

/** Translate everything so the drawing starts at the origin and report its tight size. */
function normalise(nodes: FigNode[], edges: FigEdge[], legend: LegendItem[]): FigureLayout {
	const box = bounds(nodes, edges);
	for (const item of legend) {
		box.minX = Math.min(box.minX, item.x);
		box.maxX = Math.max(box.maxX, item.text.x + item.text.width);
		box.maxY = Math.max(box.maxY, item.y + item.h, item.text.y + item.text.height);
	}
	const dx = -box.minX;
	const dy = -box.minY;
	const shiftText = (t: PlacedText) => ({ ...t, x: t.x + dx, y: t.y + dy });
	return {
		width: box.maxX - box.minX,
		height: box.maxY - box.minY,
		nodes: nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy, label: shiftText(n.label) })),
		edges: edges.map((e) => ({
			...e,
			points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
		})),
		legend: legend.map((i) => ({ ...i, x: i.x + dx, y: i.y + dy, text: shiftText(i.text) }))
	};
}

/** Final placement on the page: scale to the export width, margin added at final size. */
export function figureFrame(layout: FigureLayout, s: FigureSettings) {
	const PT_PER_MM = 72 / 25.4;
	const margin = s.marginMm * PT_PER_MM;
	const naturalWidth = layout.width + 2 * margin;
	const target = s.widthMm ? s.widthMm * PT_PER_MM : naturalWidth;
	const k = layout.width > 0 ? Math.max(0.01, (target - 2 * margin) / layout.width) : 1;
	const pad = margin / k;
	const outW = layout.width * k + 2 * margin;
	const outH = layout.height * k + 2 * margin;
	return {
		/** Scale from natural size to printed size. */
		k,
		viewBox: [-pad, -pad, layout.width + 2 * pad, layout.height + 2 * pad] as const,
		widthPt: outW,
		heightPt: outH,
		widthMm: outW / PT_PER_MM,
		heightMm: outH / PT_PER_MM,
		naturalWidthMm: naturalWidth / PT_PER_MM,
		/** Printed size of normal label text. */
		printedFontPt: s.fontSize * k
	};
}

export type FigureFrame = ReturnType<typeof figureFrame>;
