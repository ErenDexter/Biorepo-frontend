import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { generateMaximalStructure } from '$lib/server/engine';
import { loadUniverse } from '$lib/server/engine/load';
import { terminalInputs } from '$lib/server/engine/helpers';
import type { ApiRawMaterial } from '$lib/types';

export const GET = async ({ url }) => {
	const productId = url.searchParams.get('productId');
	if (!productId) throw error(400, 'productId is required');

	const { materialsById, operations } = await loadUniverse(supabase());
	if (!materialsById.has(productId)) throw error(404, 'product not found');

	// Potential raw materials = materials with no producer in the universe.
	// Whether they end up wired into a given product is decided by the engine.
	const R = terminalInputs(operations);
	const ms = generateMaximalStructure({ P: new Set([productId]), R, operations });

	const result: ApiRawMaterial[] = [];
	for (const id of R) {
		if (!ms.materialIds.has(id)) continue;
		const m = materialsById.get(id);
		if (!m) continue;
		result.push({ id: m.id, name: m.name, kind: m.kind ?? '' });
	}
	result.sort((a, b) => a.name.localeCompare(b.name));
	return json(result);
};
