export type Uuid = string;

export interface Material {
	id: Uuid;
	name: string;
	kind?: string;
	properties?: Record<string, unknown>;
}

export interface Operation {
	id: Uuid;
	name: string;
	/** Material ids consumed by this operation (all required simultaneously). */
	inputs: Uuid[];
	/** Material ids produced by this operation. */
	outputs: Uuid[];
	properties?: Record<string, unknown>;
	impacts?: Record<string, unknown>;
}

export interface PGraph {
	materialIds: Set<Uuid>;
	operationIds: Set<Uuid>;
}

export interface StructuralInput {
	/** Target product material ids. */
	P: Set<Uuid>;
	/** Available raw material ids (feedstocks + utilities). */
	R: Set<Uuid>;
	/** All operations available in the universe. */
	operations: Operation[];
}
