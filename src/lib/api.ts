// Client for the biorepo FastAPI backend. All calculation and data access
// happen there; this module only moves JSON and normalises errors.

import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type {
	ApiAssessment,
	ApiClassificationTerm,
	ApiFeedstock,
	ApiLibrary,
	ApiProduct,
	ApiSuperstructure
} from './types';

// The dev server talks to a local backend; a production build to the hosted
// one. PUBLIC_API_BASE overrides either.
const DEFAULT_BASE = dev ? 'http://127.0.0.1:8000' : 'https://biorepo-api.fastapicloud.dev';

export const API_BASE = (env.PUBLIC_API_BASE || DEFAULT_BASE).replace(/\/$/, '');

/** An RFC 9457 problem from the backend; `code` is the library's own error code. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		detail: string
	) {
		super(detail);
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${API_BASE}${path}`, {
			...init,
			headers: { 'content-type': 'application/json', ...init?.headers }
		});
	} catch {
		throw new ApiError(0, 'unreachable', `Cannot reach the backend at ${API_BASE}. Is it running?`);
	}
	const text = await res.text();
	const body = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const code = typeof body?.type === 'string' ? body.type.split('#').pop() : String(res.status);
		const detail =
			typeof body?.detail === 'string'
				? body.detail
				: JSON.stringify(body?.detail ?? res.statusText);
		throw new ApiError(res.status, code, detail);
	}
	return body as T;
}

export interface SuperstructureQuery {
	product: string;
	/** R_init: raw materials the user declares. */
	declared: string[];
	/** Feedstocks taken out of the study, with the modules that consume them. */
	excluded: string[];
	augment: boolean;
	method?: string;
}

function synthesisBody(q: SuperstructureQuery) {
	return {
		products: [q.product],
		raw_materials: q.declared,
		module_selection: q.excluded.length ? { exclude_consuming: q.excluded } : {},
		options: { augment_raw_materials: q.augment },
		...(q.method ? { method: q.method } : {})
	};
}

export const api = {
	library: () => request<ApiLibrary>('/v1/library'),
	classifications: () => request<ApiClassificationTerm[]>('/v1/classifications'),
	products: () => request<ApiProduct[]>('/v1/synthesis/products'),
	feedstocks: (product: string) =>
		request<ApiFeedstock[]>(`/v1/synthesis/feedstocks?product=${encodeURIComponent(product)}`),
	superstructure: (q: SuperstructureQuery) =>
		request<ApiSuperstructure>('/v1/synthesis/superstructure', {
			method: 'POST',
			body: JSON.stringify(synthesisBody(q))
		}),
	/**
	 * Assess one generated pathway. The backend re-runs the same synthesis and
	 * picks the pathway by its modules, so only structures the P-graph generated
	 * are ever assessed.
	 */
	evaluate: (q: SuperstructureQuery, modules: string[], demand = 1) =>
		request<ApiAssessment>('/v1/lca/evaluate', {
			method: 'POST',
			body: JSON.stringify({ ...synthesisBody(q), pathway: { modules }, demand })
		})
};
