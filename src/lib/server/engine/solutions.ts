import type { Operation, PGraph, StructuralInput, Uuid } from './types.js';
import { matIn, producersOf } from './helpers.js';
import { diff, intersect, isEmpty, nonEmptySubsets, setKey, union } from './setOps.js';

export interface SolutionStructuresResult {
	solutions: PGraph[];
	truncated: boolean;
}

const DEFAULT_MAX_SOLUTIONS = 256;
const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Port of StructuralModel.__ssg / generate_solution_structures (engine/pgraph.py:323-369).
 *
 * Enumerates every distinct sub-network of operations that can produce P from R,
 * via depth-first powerset search with consistency checks.
 *
 * Capped at `maxSolutions` and `timeoutMs`; `truncated` reports whether either limit hit.
 */
export function generateSolutionStructures(
	{ P, R, operations }: StructuralInput,
	{ maxSolutions = DEFAULT_MAX_SOLUTIONS, timeoutMs = DEFAULT_TIMEOUT_MS }: {
		maxSolutions?: number;
		timeoutMs?: number;
	} = {}
): SolutionStructuresResult {
	if (P.size === 0) return { solutions: [], truncated: false };

	const opById = new Map(operations.map((op) => [op.id, op] as const));
	const start = Date.now();
	let truncated = false;

	// Each found solution = mapping material -> chosen set of producing ops (set of op ids).
	// Encode as Map<materialId, Set<operationId>>.
	const found: Map<Uuid, Set<Uuid>>[] = [];

	// Cache Del(x, O) per material.
	const delCache = new Map<Uuid, Operation[]>();
	const Del = (x: Uuid): Operation[] => {
		let v = delCache.get(x);
		if (!v) {
			v = producersOf(x, operations);
			delCache.set(x, v);
		}
		return v;
	};

	const ssg = (
		pending: Set<Uuid>,
		satisfied: Set<Uuid>,
		chosen: Map<Uuid, Set<Uuid>>
	): boolean => {
		if (truncated) return false;
		if (Date.now() - start > timeoutMs) {
			truncated = true;
			return false;
		}

		if (pending.size === 0) {
			found.push(new Map(chosen));
			if (found.length >= maxSolutions) {
				truncated = true;
				return false;
			}
			return true;
		}

		const x = pending.values().next().value as Uuid;
		const delX = Del(x);
		const delXIds = new Set(delX.map((op) => op.id));

		if (delX.length === 0) {
			// No producer for x and x is not raw -> infeasible branch.
			return true;
		}

		for (const subset of nonEmptySubsets(delX)) {
			const c = new Set(subset.map((op) => op.id));

			// Consistency check against every already-satisfied material y.
			let consistent = true;
			for (const y of satisfied) {
				const delY = new Set(Del(y).map((op) => op.id));
				const delYChosen = chosen.get(y) ?? new Set<Uuid>();
				const delYComp = diff(delY, delYChosen);

				// Both intersections must be empty.
				let bad = false;
				for (const id of c) if (delYComp.has(id)) { bad = true; break; }
				if (!bad) {
					for (const id of delXIds) if (!c.has(id) && delYChosen.has(id)) { bad = true; break; }
				}
				if (bad) { consistent = false; break; }
			}
			if (!consistent) continue;

			// Inputs of chosen operations.
			const cOps = subset;
			const cIn = matIn(cOps);
			const nextPending = new Set<Uuid>();
			for (const m of pending) if (m !== x) nextPending.add(m);
			for (const m of cIn) {
				if (m === x) continue;
				if (R.has(m)) continue;
				if (satisfied.has(m)) continue;
				nextPending.add(m);
			}

			const nextSatisfied = new Set(satisfied);
			nextSatisfied.add(x);

			const nextChosen = new Map(chosen);
			nextChosen.set(x, c);

			if (!ssg(nextPending, nextSatisfied, nextChosen)) return false;
		}
		return true;
	};

	ssg(new Set(P), new Set(), new Map());

	// Deduplicate by the union-of-chosen-op-ids signature (different chosen
	// mappings can produce the same operation set, mirroring the Python output).
	const seen = new Set<string>();
	const solutions: PGraph[] = [];
	for (const mapping of found) {
		const opIds = new Set<Uuid>();
		for (const opSet of mapping.values()) for (const id of opSet) opIds.add(id);
		const key = setKey(opIds);
		if (seen.has(key)) continue;
		seen.add(key);

		const materialIds = new Set<Uuid>();
		for (const id of opIds) {
			const op = opById.get(id);
			if (!op) continue;
			for (const m of op.inputs) materialIds.add(m);
			for (const m of op.outputs) materialIds.add(m);
		}
		solutions.push({ materialIds, operationIds: opIds });
	}

	return { solutions, truncated };
}
