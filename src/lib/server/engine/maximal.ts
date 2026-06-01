import type { Operation, PGraph, StructuralInput, Uuid } from './types.js';
import { consumersOf, mat, matIn, matOut, producersOf } from './helpers.js';
import { diff, intersect, isSubset, union } from './setOps.js';

/**
 * Port of StructuralModel.generate_maximal_structure (engine/pgraph.py:268-321).
 *
 * Returns the maximal sub-network of operations capable of producing P from R.
 * Empty (materialIds={}, operationIds={}) means infeasible.
 */
export function generateMaximalStructure({ P, R, operations }: StructuralInput): PGraph {
	// Reduction: remove operations that directly produce a raw material.
	let O: Operation[] = operations.filter((op) => intersect(op.outputs, R).size === 0);
	const opById = new Map(O.map((op) => [op.id, op] as const));

	let M = mat(O);
	if (!isSubset(P, M)) return { materialIds: new Set(), operationIds: new Set() };

	// Prune: drop ops that consume "dead" materials (not raw and not produced by any op).
	let T = new Set<Uuid>();
	const Mout = matOut(O);
	for (const m of M) if (!R.has(m) && !Mout.has(m)) T.add(m);

	while (T.size > 0) {
		const X = T.values().next().value as Uuid;
		T.delete(X);

		const O_X = consumersOf(X, O);
		const O_X_outputs = matOut(O_X);
		const O_X_ids = new Set(O_X.map((op) => op.id));

		O = O.filter((op) => !O_X_ids.has(op.id));
		for (const id of O_X_ids) opById.delete(id);

		M = mat(O);
		if (!isSubset(P, M)) return { materialIds: new Set(), operationIds: new Set() };

		const Min = matIn(O);
		const Mout2 = matOut(O);
		const T_new = new Set<Uuid>();
		for (const m of Min) if (O_X_outputs.has(m) && !Mout2.has(m)) T_new.add(m);

		T = union(intersect(T, M), T_new);
	}

	// Composition: backward-trace from products to raw materials.
	const W = new Set<Uuid>(P);
	const mFinal = new Set<Uuid>();
	const oFinal = new Set<Operation>();

	while (W.size > 0) {
		const X = W.values().next().value as Uuid;
		W.delete(X);
		mFinal.add(X);

		const producers = producersOf(X, O);
		for (const op of producers) oFinal.add(op);

		for (const op of producers) {
			for (const inMat of op.inputs) {
				if (!R.has(inMat) && !mFinal.has(inMat)) W.add(inMat);
			}
		}
	}

	const materialIds = mat(oFinal);
	const operationIds = new Set<Uuid>();
	for (const op of oFinal) operationIds.add(op.id);

	return { materialIds, operationIds };
}
