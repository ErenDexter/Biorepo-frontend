import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { loadUniverse } from '$lib/server/engine/load';
import { terminalOutputs } from '$lib/server/engine/helpers';
import type { ApiProduct } from '$lib/types';

const EXCLUDED_KINDS = new Set(['byproduct', 'waste']);

export const GET = async () => {
	const sb = supabase();
	let universe;
	try {
		universe = await loadUniverse(sb);
	} catch (e) {
		throw error(500, e instanceof Error ? e.message : String(e));
	}

	const terminals = terminalOutputs(universe.operations);
	const out: ApiProduct[] = [];
	for (const id of terminals) {
		const m = universe.materialsById.get(id);
		if (!m) continue;
		if (m.kind && EXCLUDED_KINDS.has(m.kind)) continue;
		out.push({ id: m.id, name: m.name });
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return json(out);
};
