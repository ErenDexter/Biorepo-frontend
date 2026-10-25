// Shapes returned by the biorepo FastAPI backend (see backend/src/biorepo_api).

export interface ApiProduct {
	slug: string;
	name: string;
	terminal: boolean;
	classification: string[];
}

export interface ApiFeedstock {
	slug: string;
	name: string;
	/** `feedstock`: biomass declared in R_init. `auxiliary`: reagents augmentation would promote. */
	kind: 'feedstock' | 'auxiliary';
	classification: string[];
	consumers: string[];
}

export type MaterialRole = 'raw' | 'intermediate' | 'product' | 'byproduct';

export interface MaterialNode {
	id: string;
	type: 'material';
	label: string;
	role: MaterialRole;
	raw_origin: 'declared' | 'augmented' | null;
	description: string | null;
	classification: string[];
	properties: Record<string, unknown>;
}

export interface OperationNode {
	id: string;
	type: 'operation';
	label: string;
	description: string | null;
	classification: string[];
	stage: string | null;
	utilities: Record<string, string>;
	basis: { material: string; quantity: number; unit: string };
	linking: { material: string; mu_prime: number; unit: string } | null;
	/** Specific impact vector h~, keyed by category id. */
	impacts: Record<string, number>;
	provenance: Record<string, string>;
	properties: Record<string, unknown>;
}

export type GraphNode = MaterialNode | OperationNode;

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	role: string;
}

export interface ImpactCategory {
	id: string;
	code: string;
	name: string;
	unit: string;
}

export interface ApiPathway {
	/** P01, P02, ... realisable first, then by the first impact category. */
	id: string;
	key: string;
	/** Module slugs, in chain order (head first) when assessable. */
	modules: string[];
	materials: string[];
	assessable: boolean;
	feedstock: string | null;
	realisable: boolean;
	utilities: Record<string, string[]>;
	/** Impact per category code (h). */
	impacts: Record<string, number> | null;
	/** Scaling vector s, per module slug. */
	scaling_factors: Record<string, number> | null;
	/** Per category code, per module: h~_kj * s_j. */
	contributions: Record<string, Record<string, number>> | null;
	warnings: string[];
	error: { code: string; detail: string } | null;
}

export interface ApiStructure {
	id: string;
	key: string;
	modules: string[];
	materials: string[];
	is_pathway: boolean;
	pathway_id: string | null;
}

export interface ApiSuperstructure {
	products: string[];
	raw_materials: { declared: string[]; augmented: string[]; excluded: string[] };
	stats: {
		modules_selected: number;
		maximal_structure: number;
		solution_structures: number;
		pathways: number;
		unassessable: number;
		realisable: number;
	};
	warnings: string[];
	provenance: { library: string; version: number };
	feasible: boolean;
	method: string;
	rank_by: string | null;
	categories: ImpactCategory[];
	graph: { nodes: GraphNode[]; edges: GraphEdge[] };
	pathways: ApiPathway[];
	structures: ApiStructure[];
}

export interface ApiLibrary {
	slug: string;
	name: string;
	description: string | null;
	version: number;
	license: string | null;
	counts: { materials: number; modules: number; collections: number; impact_methods: number };
}

export interface ApiClassificationTerm {
	id: string;
	facet: string;
	code: string;
	label: string;
	parent_id: string | null;
}

/** One assessment from POST /v1/lca/evaluate: every intermediate of Eq. (6)-(12). */
export interface ApiAssessment {
	target: string;
	/** Amount of the functional unit, FU in Eq. (12). */
	demand: number;
	functional_unit: string;
	conversion_factor: number | null;
	method: string;
	/** Row/column j of A: module j and the material its output is measured in. */
	basis: { index: number; module: string; material: string }[];
	/** Technology matrix, N x N. */
	A: number[][];
	/** Specific impact matrix H~, Z x N; rows are category ids. */
	H: { rows: string[]; values: number[][] };
	/** Final demand vector (one unit of the product). */
	f: number[];
	/** Scaling vector s = A^-1 f. */
	s: number[];
	/** Impact vector h = FU * H~ s. */
	h: { category: string; code: string; name: string; value: number; unit: string }[];
	/** Per category id, per module: h~_kj * s_j. */
	contributions: Record<string, Record<string, number>>;
	scaling_factors: Record<string, number>;
	diagnostics: {
		n_modules: number;
		condition_number: number;
		determinant: number;
		is_linear_chain: boolean;
	};
	warnings: string[];
	provenance: Record<string, unknown>;
	synthesis: { solution_structures: number; pathways: number; warnings: string[] };
}
