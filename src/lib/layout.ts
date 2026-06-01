import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphEdge, GraphNode } from './types';

const elk = new ELK();

const NODE_H = 32;

export type Orientation = 'horizontal' | 'vertical';

export interface PositionedNode extends GraphNode {
	position: { x: number; y: number };
	width: number;
	height: number;
}

export interface EdgePath {
	id: string;
	source: string;
	target: string;
	/** Polyline points in graph coordinates (including start and end). */
	points: { x: number; y: number }[];
}

export interface LayoutResult {
	nodes: PositionedNode[];
	edges: EdgePath[];
}

// Per-char text-width estimates, calibrated for our Tailwind classes.
// Material: text-xs (12px) medium  — Operation: text-[11px] uppercase tracking-wide.
function textWidth(label: string, op: boolean): number {
	return op ? label.length * 8.5 : label.length * 6.8;
}

export function nodeWidth(n: { label: string; type: 'material' | 'operation'; isPlatform?: boolean }): number {
	if (n.type === 'operation') {
		return Math.max(140, Math.ceil((textWidth(n.label, true) + 30) / 10) * 10);
	}
	const badge = n.isPlatform ? 78 : 0;
	return Math.max(80, Math.ceil((textWidth(n.label, false) + 30 + badge) / 10) * 10);
}

export async function layoutGraph(
	nodes: GraphNode[],
	edges: GraphEdge[],
	orientation: Orientation = 'horizontal'
): Promise<LayoutResult> {
	const widthById = new Map(nodes.map((n) => [n.id, nodeWidth(n)] as const));

	const elkGraph: ElkNode = {
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': orientation === 'horizontal' ? 'RIGHT' : 'DOWN',
			'elk.edgeRouting': 'ORTHOGONAL',
			'elk.spacing.nodeNode': '40',
			'elk.layered.spacing.nodeNodeBetweenLayers': '80',
			'elk.spacing.edgeNode': '20',
			'elk.spacing.edgeEdge': '12',
			'elk.layered.spacing.edgeNodeBetweenLayers': '24',
			'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
			'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
			'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
			'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'
		},
		children: nodes.map((n) => ({
			id: n.id,
			width: widthById.get(n.id) ?? 160,
			height: NODE_H
		})),
		edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))
	};
	const laid = await elk.layout(elkGraph);

	const byId = new Map((laid.children ?? []).map((c) => [c.id, c] as const));
	const positionedNodes: PositionedNode[] = nodes.map((n) => {
		const c = byId.get(n.id);
		return {
			...n,
			position: { x: c?.x ?? 0, y: c?.y ?? 0 },
			width: c?.width ?? widthById.get(n.id) ?? 160,
			height: c?.height ?? NODE_H
		};
	});

	const edgePaths: EdgePath[] = (laid.edges ?? []).map((e: ElkExtendedEdge) => {
		const section = e.sections?.[0];
		const pts: { x: number; y: number }[] = [];
		if (section) {
			pts.push({ x: section.startPoint.x, y: section.startPoint.y });
			for (const bp of section.bendPoints ?? []) pts.push({ x: bp.x, y: bp.y });
			pts.push({ x: section.endPoint.x, y: section.endPoint.y });
		}
		return {
			id: e.id,
			source: e.sources[0],
			target: e.targets[0],
			points: pts
		};
	});

	return { nodes: positionedNodes, edges: edgePaths };
}
