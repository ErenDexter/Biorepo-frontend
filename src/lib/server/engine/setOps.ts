export function union<T>(...sets: Iterable<T>[]): Set<T> {
	const out = new Set<T>();
	for (const s of sets) for (const x of s) out.add(x);
	return out;
}

export function intersect<T>(a: Iterable<T>, b: Set<T>): Set<T> {
	const out = new Set<T>();
	for (const x of a) if (b.has(x)) out.add(x);
	return out;
}

export function diff<T>(a: Iterable<T>, b: Set<T>): Set<T> {
	const out = new Set<T>();
	for (const x of a) if (!b.has(x)) out.add(x);
	return out;
}

export function isEmpty<T>(s: Set<T>): boolean {
	return s.size === 0;
}

export function isSubset<T>(a: Set<T>, b: Set<T>): boolean {
	if (a.size > b.size) return false;
	for (const x of a) if (!b.has(x)) return false;
	return true;
}

export function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
	if (a.size !== b.size) return false;
	for (const x of a) if (!b.has(x)) return false;
	return true;
}

/**
 * Non-empty subsets of `items`. Matches Python's `chain.from_iterable(combinations(s, r) for r in range(1, len(s)+1))`.
 */
export function* nonEmptySubsets<T>(items: T[]): Generator<T[]> {
	const n = items.length;
	if (n === 0) return;
	const total = 1 << n;
	for (let mask = 1; mask < total; mask++) {
		const subset: T[] = [];
		for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(items[i]);
		yield subset;
	}
}

/** Stable canonical key for a set of ids. */
export function setKey(ids: Iterable<string>): string {
	return [...ids].sort().join('|');
}
