<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		MarkerType,
		type Node,
		type Edge
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import type {
		ApiRawMaterial,
		ApiSuperstructure,
		GraphNode
	} from '$lib/types';
	import { layoutGraph } from '$lib/layout';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { orientation } from '$lib/stores/orientation.svelte';
	import MaterialNode from '$lib/components/MaterialNode.svelte';
	import OperationNode from '$lib/components/OperationNode.svelte';
	import OrthogonalEdge from '$lib/components/OrthogonalEdge.svelte';
	import Inspector from '$lib/components/Inspector.svelte';
	import RawMaterialList from '$lib/components/RawMaterialList.svelte';

	const productId = $derived(page.url.searchParams.get('productId') ?? '');

	let rawMaterials = $state<ApiRawMaterial[]>([]);
	let included = $state(new Set<string>());
	let superstructure = $state<ApiSuperstructure | null>(null);
	let inspected = $state<GraphNode | null>(null);

	let loadingRaws = $state(true);
	let loadingGraph = $state(false);
	let errorMsg = $state<string | null>(null);
	let showUtilities = $state(false);

	// Base graph (what the server returned, with positions). Drives display.
	let nodes = $state.raw<Node[]>([]);
	let baseEdges = $state.raw<Edge[]>([]);
	// Styled edges actually bound to SvelteFlow. Updated by $effect below
	// whenever baseEdges or highlight changes.
	let edges = $state.raw<Edge[]>([]);

	const nodeTypes = { material: MaterialNode as never, operation: OperationNode as never };
	const edgeTypes = { orthogonal: OrthogonalEdge as never };

	onMount(async () => {
		if (!productId) {
			errorMsg = 'Missing productId in URL';
			loadingRaws = false;
			return;
		}
		try {
			const res = await fetch(`/api/raw-materials?productId=${encodeURIComponent(productId)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			rawMaterials = await res.json();
			included = new Set(rawMaterials.map((r) => r.id));
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : String(e);
		} finally {
			loadingRaws = false;
		}
		await rebuild();
	});

	let debounce: ReturnType<typeof setTimeout> | null = null;
	function schedule() {
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(rebuild, 150);
	}

	const ARROW = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#475569' };

	async function rebuild() {
		loadingGraph = true;
		try {
			const res = await fetch('/api/superstructure', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					productId,
					includedRawMaterialIds: [...included]
				})
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const payload = (await res.json()) as ApiSuperstructure;
			superstructure = payload;

			if (!payload.meta.feasible) {
				nodes = [];
				baseEdges = [];
				return;
			}
			await applyLayout(payload);
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : String(e);
		} finally {
			loadingGraph = false;
		}
	}

	// Reactively re-style edges whenever the base graph or the highlight set changes.
	$effect(() => {
		if (!highlight.active) {
			edges = baseEdges;
			return;
		}
		const lit = highlight.edgeIds;
		edges = baseEdges.map((e) =>
			lit.has(e.id)
				? {
						...e,
						style: 'stroke:#0f172a;stroke-width:3',
						animated: true,
						markerEnd: { ...ARROW, color: '#0f172a' }
					}
				: { ...e, style: 'stroke:#cbd5e1;stroke-width:1;opacity:0.25' }
		);
	});

	async function applyLayout(payload: ApiSuperstructure) {
		// Optional client-side filter: drop utility nodes + any edges touching them.
		const visibleNodes = showUtilities
			? payload.nodes
			: payload.nodes.filter((n) => n.kind !== 'utility');
		const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
		const visibleEdges = payload.edges.filter(
			(e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
		);

		const laid = await layoutGraph(visibleNodes, visibleEdges, orientation.value);

		nodes = laid.nodes.map((n) => ({
			id: n.id,
			type: n.type,
			position: n.position,
			data: {
				label: n.label,
				kind: n.kind,
				isPlatform: n.isPlatform,
				width: n.width,
				...(n.data ?? {})
			}
		}));

		const pointsById = new Map(laid.edges.map((e) => [e.id, e.points] as const));
		baseEdges = visibleEdges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			type: 'orthogonal',
			markerEnd: ARROW,
			style: 'stroke:#475569;stroke-width:1.5',
			data: { points: pointsById.get(e.id) ?? [] }
		}));
	}

	async function relayout() {
		if (!superstructure?.meta.feasible) return;
		await applyLayout(superstructure);
	}

	function onToggle(id: string, checked: boolean) {
		const next = new Set(included);
		if (checked) next.add(id);
		else next.delete(id);
		included = next;
		schedule();
	}

	function nodeFromId(id: string): GraphNode | null {
		return superstructure?.nodes.find((n) => n.id === id) ?? null;
	}
</script>

<svelte:head><title>Superstructure</title></svelte:head>

<div class="flex h-screen w-screen flex-col bg-slate-100">
	<header class="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
		<a href="/" class="text-sm text-slate-600 hover:text-slate-900">← Back</a>
		<h1 class="text-sm font-semibold text-slate-900">Superstructure</h1>
		{#if superstructure}
			{@const materialCount = superstructure.nodes.filter((n) => n.type === 'material').length}
			{@const operationCount = superstructure.nodes.filter((n) => n.type === 'operation').length}
			<span class="text-xs text-slate-500">
				{superstructure.meta.solutionCount} pathway{superstructure.meta.solutionCount === 1 ? '' : 's'}
				· {materialCount} material{materialCount === 1 ? '' : 's'}
				· {operationCount} operation{operationCount === 1 ? '' : 's'}
				{#if superstructure.meta.truncated}<span class="text-amber-600"> · truncated</span>{/if}
			</span>
		{/if}
		{#if loadingGraph}<span class="text-xs text-slate-400">computing…</span>{/if}
		{#if errorMsg}<span class="text-xs text-red-600">{errorMsg}</span>{/if}

		<div class="ml-auto flex items-center gap-2">
			<label class="flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
				<input
					type="checkbox"
					class="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
					bind:checked={showUtilities}
					onchange={() => void relayout()}
				/>
				Show utilities
			</label>
			<button
				type="button"
				class="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
				onclick={() => {
					orientation.toggle();
					void relayout();
				}}
				title="Toggle layout direction"
			>
				{orientation.value === 'horizontal' ? '→ Horizontal' : '↓ Vertical'}
			</button>
		</div>
	</header>

	<div class="flex flex-1 overflow-hidden">
		{#if loadingRaws}
			<aside class="w-64 border-r border-slate-200 bg-white p-4 text-sm text-slate-500">
				Loading raw materials…
			</aside>
		{:else}
			<RawMaterialList
				{rawMaterials}
				{included}
				solutions={superstructure?.solutions ?? []}
				{onToggle}
			/>
		{/if}

		<main class="relative flex-1">
			{#if superstructure && !superstructure.meta.feasible}
				<div class="absolute inset-0 flex items-center justify-center">
					<p class="rounded bg-white px-4 py-3 text-sm text-slate-600 shadow">
						No feasible pathway with the current raw-material selection.
					</p>
				</div>
			{/if}
			<SvelteFlow
				bind:nodes
				bind:edges
				{nodeTypes}
				{edgeTypes}
				fitView
				nodesDraggable={false}
				proOptions={{ hideAttribution: true }}
				onnodepointerenter={({ node }) => {
					inspected = nodeFromId(node.id);
					highlight.set([node.id], []);
				}}
				onnodepointerleave={() => {
					highlight.clear();
				}}
			>
				<Background />
				<Controls />
				<MiniMap />
			</SvelteFlow>
		</main>

		<Inspector node={inspected} />
	</div>
</div>
