import type { SupabaseClient } from '@supabase/supabase-js';
import type { Material, Operation } from './types.js';

interface MaterialRow {
	id: string;
	name: string;
	kind: string;
	properties: Record<string, unknown> | null;
}

interface OperationRow {
	id: string;
	name: string;
	properties: Record<string, unknown> | null;
	impacts: Record<string, unknown> | null;
}

interface OperationIoRow {
	operation_id: string;
	material_id: string;
	role: 'in' | 'out';
	is_primary: boolean;
}

export interface LoadedUniverse {
	materials: Material[];
	materialsById: Map<string, Material>;
	operations: Operation[];
}

export async function loadUniverse(sb: SupabaseClient): Promise<LoadedUniverse> {
	const [matRes, opRes, ioRes] = await Promise.all([
		sb.from('material').select('id, name, kind, properties'),
		sb.from('operation').select('id, name, properties, impacts'),
		sb.from('operation_io').select('operation_id, material_id, role, is_primary')
	]);

	if (matRes.error) throw matRes.error;
	if (opRes.error) throw opRes.error;
	if (ioRes.error) throw ioRes.error;

	const materials: Material[] = (matRes.data as MaterialRow[]).map((r) => ({
		id: r.id,
		name: r.name,
		kind: r.kind,
		properties: r.properties ?? {}
	}));
	const materialsById = new Map(materials.map((m) => [m.id, m] as const));

	const opIo = ioRes.data as OperationIoRow[];
	const inputsByOp = new Map<string, string[]>();
	const outputsByOp = new Map<string, string[]>();
	for (const row of opIo) {
		const target = row.role === 'in' ? inputsByOp : outputsByOp;
		const arr = target.get(row.operation_id);
		if (arr) arr.push(row.material_id);
		else target.set(row.operation_id, [row.material_id]);
	}

	const operations: Operation[] = (opRes.data as OperationRow[]).map((r) => ({
		id: r.id,
		name: r.name,
		inputs: inputsByOp.get(r.id) ?? [],
		outputs: outputsByOp.get(r.id) ?? [],
		properties: r.properties ?? {},
		impacts: r.impacts ?? {}
	}));

	return { materials, materialsById, operations };
}
