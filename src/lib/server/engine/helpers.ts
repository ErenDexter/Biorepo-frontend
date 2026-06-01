import type { Operation, Uuid } from './types.js';

/** Materials consumed by any operation in `ops`. */
export function matIn(ops: Iterable<Operation>): Set<Uuid> {
	const out = new Set<Uuid>();
	for (const op of ops) for (const m of op.inputs) out.add(m);
	return out;
}

/** Materials produced by any operation in `ops`. */
export function matOut(ops: Iterable<Operation>): Set<Uuid> {
	const out = new Set<Uuid>();
	for (const op of ops) for (const m of op.outputs) out.add(m);
	return out;
}

/** Union of inputs and outputs of `ops`. */
export function mat(ops: Iterable<Operation>): Set<Uuid> {
	const out = new Set<Uuid>();
	for (const op of ops) {
		for (const m of op.inputs) out.add(m);
		for (const m of op.outputs) out.add(m);
	}
	return out;
}

/** Operations in `ops` that produce material `x`. */
export function producersOf(x: Uuid, ops: Iterable<Operation>): Operation[] {
	const out: Operation[] = [];
	for (const op of ops) if (op.outputs.includes(x)) out.push(op);
	return out;
}

/** Operations in `ops` that consume material `x`. */
export function consumersOf(x: Uuid, ops: Iterable<Operation>): Operation[] {
	const out: Operation[] = [];
	for (const op of ops) if (op.inputs.includes(x)) out.push(op);
	return out;
}

/** Material ids that are produced by some op in `ops` but consumed by none. */
export function terminalOutputs(ops: Iterable<Operation>): Set<Uuid> {
	const produced = new Set<Uuid>();
	const consumed = new Set<Uuid>();
	for (const op of ops) {
		for (const m of op.outputs) produced.add(m);
		for (const m of op.inputs) consumed.add(m);
	}
	const out = new Set<Uuid>();
	for (const m of produced) if (!consumed.has(m)) out.add(m);
	return out;
}

/** Material ids that are consumed by some op in `ops` but produced by none. */
export function terminalInputs(ops: Iterable<Operation>): Set<Uuid> {
	const produced = new Set<Uuid>();
	const consumed = new Set<Uuid>();
	for (const op of ops) {
		for (const m of op.outputs) produced.add(m);
		for (const m of op.inputs) consumed.add(m);
	}
	const out = new Set<Uuid>();
	for (const m of consumed) if (!produced.has(m)) out.add(m);
	return out;
}
