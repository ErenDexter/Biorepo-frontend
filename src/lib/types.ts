// Shared API + UI types for the superstructure response.

export interface ApiProduct {
	id: string;
	name: string;
}

export interface ApiRawMaterial {
	id: string;
	name: string;
	kind: string;
}

export type GraphNodeKind =
	| 'raw'
	| 'intermediate'
	| 'platform'
	| 'product'
	| 'utility'
	| 'byproduct'
	| 'waste';

export interface GraphNode {
	id: string;
	type: 'material' | 'operation';
	label: string;
	/** Material kind, only set when type='material'. */
	kind?: GraphNodeKind;
	isPlatform?: boolean;
	data?: Record<string, unknown>;
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	data?: {
		materialId?: string;
	};
}

export interface ApiSolution {
	id: string;
	nodeIds: string[];
	edgeIds: string[];
	rawMaterialIds: string[];
}

export interface ApiSuperstructure {
	nodes: GraphNode[];
	edges: GraphEdge[];
	solutions: ApiSolution[];
	meta: {
		feasible: boolean;
		droppedOperationIds: string[];
		solutionCount: number;
		truncated: boolean;
	};
}
