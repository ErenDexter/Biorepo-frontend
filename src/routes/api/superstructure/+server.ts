import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { supabase } from '$lib/server/supabase';
import { generateMaximalStructure, generateSolutionStructures } from '$lib/server/engine';
import { loadUniverse } from '$lib/server/engine/load';
import { terminalInputs } from '$lib/server/engine/helpers';
import type { ApiSuperstructure, GraphEdge, GraphNode, GraphNodeKind } from '$lib/types';

const Body = z.object({
	productId: z.string().uuid(),
	includedRawMaterialIds: z.array(z.string().uuid())
});

export const POST = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.message);
	const { productId, includedRawMaterialIds } = parsed.data;

	const { materialsById, operations } = await loadUniverse(supabase());
	if (!materialsById.has(productId)) throw error(404, 'product not found');

	// R = exactly the user-selected raw materials, intersected with the set of
	// materials that actually have no producer in the universe. (Anything else
	// in the request is ignored to keep R structurally sound.)
	const candidateRaws = terminalInputs(operations);
	const R = new Set<string>();
	for (const id of includedRawMaterialIds) if (candidateRaws.has(id)) R.add(id);

	const P = new Set([productId]);
	const ms = generateMaximalStructure({ P, R, operations });
	const feasible = ms.operationIds.size > 0;

	// Compute platform materials = materials in the maximal structure that
	// (a) have ≥2 producing operations in the structure (alternative upstream paths),
	// AND (b) are consumed by ≥1 operation in the structure (i.e., on the way to
	// the product — not a dead-end byproduct that just happens to be produced by
	// multiple routes, like gypsum from both fermentations).
	const producerCount = new Map<string, number>();
	const consumerCount = new Map<string, number>();
	for (const opId of ms.operationIds) {
		const op = operations.find((o) => o.id === opId)!;
		for (const m of op.outputs) {
			if (!ms.materialIds.has(m)) continue;
			producerCount.set(m, (producerCount.get(m) ?? 0) + 1);
		}
		for (const m of op.inputs) {
			if (!ms.materialIds.has(m)) continue;
			consumerCount.set(m, (consumerCount.get(m) ?? 0) + 1);
		}
	}
	const platformIds = new Set<string>();
	for (const [m, n] of producerCount) {
		if (n >= 2 && (consumerCount.get(m) ?? 0) >= 1) platformIds.add(m);
	}

	let solutions: ApiSuperstructure['solutions'] = [];
	let truncated = false;

	if (feasible) {
		const msOps = operations.filter((o) => ms.operationIds.has(o.id));
		const res = generateSolutionStructures({ P, R, operations: msOps });
		truncated = res.truncated;

		// Keep only minimal solutions: drop any whose op set is a strict superset of
		// another's. This removes "both routes simultaneously" merged solutions that
		// would otherwise make raw-material hover highlight every pathway.
		const all = res.solutions;
		const minimal = all.filter((s, i) =>
			!all.some(
				(other, j) =>
					i !== j &&
					other.operationIds.size < s.operationIds.size &&
					[...other.operationIds].every((id) => s.operationIds.has(id))
			)
		);

		solutions = minimal.map((sol, i) => {
			const nodeIds: string[] = [];
			const edgeIds: string[] = [];
			for (const id of sol.materialIds) nodeIds.push(id);
			for (const id of sol.operationIds) nodeIds.push(id);
			for (const opId of sol.operationIds) {
				const op = operations.find((o) => o.id === opId)!;
				for (const m of op.inputs) if (sol.materialIds.has(m)) edgeIds.push(`${m}->${opId}`);
				for (const m of op.outputs) if (sol.materialIds.has(m)) edgeIds.push(`${opId}->${m}`);
			}
			const rawMaterialIds = [...sol.materialIds].filter((id) => R.has(id));
			return { id: `s${i + 1}`, nodeIds, edgeIds, rawMaterialIds };
		});
	}

	const nodes: GraphNode[] = [];
	for (const id of ms.materialIds) {
		const m = materialsById.get(id)!;
		nodes.push({
			id,
			type: 'material',
			label: m.name,
			kind: (m.kind ?? undefined) as GraphNodeKind | undefined,
			isPlatform: platformIds.has(id),
			data: { properties: m.properties ?? {} }
		});
	}
	for (const id of ms.operationIds) {
		const op = operations.find((o) => o.id === id)!;
		nodes.push({
			id,
			type: 'operation',
			label: op.name,
			data: { properties: op.properties ?? {}, impacts: op.impacts ?? {} }
		});
	}

	const edges: GraphEdge[] = [];
	for (const opId of ms.operationIds) {
		const op = operations.find((o) => o.id === opId)!;
		for (const m of op.inputs) {
			if (!ms.materialIds.has(m)) continue;
			edges.push({ id: `${m}->${opId}`, source: m, target: opId, data: { materialId: m } });
		}
		for (const m of op.outputs) {
			if (!ms.materialIds.has(m)) continue;
			edges.push({ id: `${opId}->${m}`, source: opId, target: m, data: { materialId: m } });
		}
	}

	const allOpIds = new Set(operations.map((o) => o.id));
	const droppedOperationIds = [...allOpIds].filter((id) => !ms.operationIds.has(id));

	const payload: ApiSuperstructure = {
		nodes,
		edges,
		solutions,
		meta: {
			feasible,
			droppedOperationIds,
			solutionCount: solutions.length,
			truncated
		}
	};
	return json(payload);
};
