<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, ApiError, type SuperstructureQuery } from '$lib/api';
	import type { ApiFeedstock, ApiSuperstructure } from '$lib/types';
	import { figure, saveFigureSettings } from '$lib/figure/settings.svelte';
	import { figureFrame, layoutFigure, type FigureLayout, type Highlight } from '$lib/figure/layout';
	import { measureText } from '$lib/figure/text';
	import Canvas from '$lib/components/Canvas.svelte';
	import Figure from '$lib/components/Figure.svelte';
	import FigurePanel from '$lib/components/FigurePanel.svelte';
	import Inspector from '$lib/components/Inspector.svelte';
	import LcaSteps from '$lib/components/LcaSteps.svelte';
	import PathwayList from '$lib/components/PathwayList.svelte';
	import RawMaterialList from '$lib/components/RawMaterialList.svelte';

	const product = $derived(page.url.searchParams.get('product') ?? '');

	let feedstocks = $state.raw<ApiFeedstock[]>([]);
	let declared = $state.raw(new Set<string>());
	let excluded = $state.raw(new Set<string>());
	let augment = $state(true);
	let data = $state.raw<ApiSuperstructure | null>(null);
	/** The synthesis inputs `data` was computed from. */
	let dataQuery = $state.raw<SuperstructureQuery | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);
	let terms = $state.raw(new Map<string, string>());

	let selection = $state<{ kind: 'pathway' | 'structure'; key: string } | null>(null);
	let isolate = $state(false);
	let hover = $state.raw<Highlight | null>(null);
	let hoveredNode = $state<string | null>(null);
	let pinnedNode = $state<string | null>(null);
	let tab = $state<'figure' | 'inspect' | 'lca'>('figure');
	const TABS = [
		{ id: 'figure', label: 'Figure' },
		{ id: 'inspect', label: 'Inspector' },
		{ id: 'lca', label: 'LCA steps' }
	] as const;

	let layout = $state.raw<FigureLayout | null>(null);
	let exportSvg = $state<SVGSVGElement>();

	const chip = 'rounded bg-slate-100 px-1.5 py-0.5 tabular-nums';

	$effect(() => saveFigureSettings());

	const message = (e: unknown) =>
		e instanceof ApiError || e instanceof Error ? e.message : String(e);

	// -- data -----------------------------------------------------------------

	let requestSeq = 0;
	async function rebuild() {
		const ticket = ++requestSeq;
		loading = true;
		try {
			const query = { product, declared: [...declared], excluded: [...excluded], augment };
			const res = await api.superstructure(query);
			if (ticket !== requestSeq) return;
			data = res;
			dataQuery = query;
			errorMsg = null;
			const pool = selection?.kind === 'pathway' ? res.pathways : res.structures;
			if (selection && !pool.some((x) => x.key === selection!.key)) selection = null;
		} catch (e) {
			if (ticket === requestSeq) errorMsg = message(e);
		} finally {
			if (ticket === requestSeq) loading = false;
		}
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(rebuild, 120);
	}

	onMount(async () => {
		if (!product) {
			errorMsg = 'No product selected.';
			loading = false;
			return;
		}
		api
			.classifications()
			.then((ts) => (terms = new Map(ts.map((t) => [t.id, t.label]))))
			.catch(() => {});
		try {
			feedstocks = await api.feedstocks(product);
			// Every candidate starts declared in R_init, auxiliary inputs included.
			declared = new Set(feedstocks.map((f) => f.slug));
		} catch (e) {
			errorMsg = message(e);
			loading = false;
			return;
		}
		await rebuild();
	});

	function onfeedstock(slug: string, included: boolean) {
		const d = new Set(declared);
		const x = new Set(excluded);
		if (included) {
			d.add(slug);
			x.delete(slug);
		} else {
			d.delete(slug);
			x.add(slug);
		}
		declared = d;
		excluded = x;
		schedule();
	}

	function onauxiliary(slug: string, on: boolean) {
		const d = new Set(declared);
		if (on) d.add(slug);
		else d.delete(slug);
		declared = d;
		schedule();
	}

	// -- graph and selection --------------------------------------------------

	const graph = $derived(data?.graph ?? { nodes: [], edges: [] });
	const nodesById = $derived(new Map(graph.nodes.map((n) => [n.id, n] as const)));
	const names = $derived(
		new Map<string, string>([
			...feedstocks.map((f) => [f.slug, f.name] as const),
			...graph.nodes.map((n) => [n.id, n.label] as const)
		])
	);
	const productName = $derived(names.get(product) ?? product);

	const selectedPathway = $derived(
		selection?.kind === 'pathway'
			? (data?.pathways.find((p) => p.key === selection!.key) ?? null)
			: null
	);
	const selectedStructure = $derived(
		selection?.kind === 'structure'
			? (data?.structures.find((s) => s.key === selection!.key) ?? null)
			: null
	);
	const selectedLabel = $derived(selectedPathway?.id ?? selectedStructure?.id ?? null);
	const selectedModules = $derived(selectedPathway?.modules ?? selectedStructure?.modules ?? null);

	/** A sub-structure is fixed by its operating units; its arcs are theirs. */
	function structureHighlight(modules: Iterable<string>): Highlight {
		const ops = new Set(modules);
		const nodes = new Set<string>(ops);
		const edges = new Set<string>();
		for (const e of graph.edges) {
			if (ops.has(e.source) || ops.has(e.target)) {
				edges.add(e.id);
				nodes.add(e.source);
				nodes.add(e.target);
			}
		}
		return { nodes, edges };
	}

	const selectionHighlight = $derived(selectedModules ? structureHighlight(selectedModules) : null);
	const isolated = $derived(isolate && !!selectionHighlight);
	const figNodes = $derived(
		isolated ? graph.nodes.filter((n) => selectionHighlight!.nodes.has(n.id)) : graph.nodes
	);
	const figEdges = $derived(
		isolated ? graph.edges.filter((e) => selectionHighlight!.edges.has(e.id)) : graph.edges
	);
	const exportHighlight = $derived(isolated ? null : selectionHighlight);

	const annotations = $derived.by(() => {
		const out = new Map<string, string>();
		if (!figure.annotateScaling || !selectedPathway?.scaling_factors) return out;
		for (const [slug, s] of Object.entries(selectedPathway.scaling_factors)) {
			const op = nodesById.get(slug);
			if (op?.type === 'operation') out.set(op.basis.material, `s = ${s.toFixed(2)}`);
		}
		return out;
	});

	function hoverMaterial(slug: string | null) {
		if (!slug || !data) return (hover = null);
		const using = data.pathways.filter((p) => p.materials.includes(slug));
		hover = using.length
			? structureHighlight(using.flatMap((p) => p.modules))
			: nodesById.has(slug)
				? { nodes: new Set([slug]), edges: new Set() }
				: null;
	}

	/** A node, its arcs and the nodes at their other ends. */
	function neighbourhood(id: string): Highlight {
		const nodes = new Set([id]);
		const edges = new Set<string>();
		for (const e of graph.edges) {
			if (e.source === id || e.target === id) {
				edges.add(e.id);
				nodes.add(e.source);
				nodes.add(e.target);
			}
		}
		return { nodes, edges };
	}

	function nodeEnter(id: string) {
		hoveredNode = id;
		hover = neighbourhood(id);
	}

	// A clicked node stays highlighted until the canvas background is clicked;
	// hovering still previews other nodes, and the selected structure shows again
	// once nothing is pinned.
	const pinnedHighlight = $derived(
		pinnedNode && nodesById.has(pinnedNode) ? neighbourhood(pinnedNode) : null
	);
	const screenHighlight = $derived(hover ?? pinnedHighlight ?? exportHighlight);

	const inspectedNode = $derived(nodesById.get(pinnedNode ?? hoveredNode ?? '') ?? null);

	// -- layout ---------------------------------------------------------------

	let layoutSeq = 0;
	$effect(() => {
		const nodes = figNodes;
		const edges = figEdges;
		const notes = annotations;
		const settings = $state.snapshot(figure);
		const ticket = ++layoutSeq;
		if (!nodes.length) {
			layout = null;
			return;
		}
		layoutFigure(nodes, edges, settings, measureText, notes)
			.then((l) => {
				if (ticket === layoutSeq) layout = l;
			})
			.catch((e) => (errorMsg = `Layout failed: ${message(e)}`));
	});

	const frame = $derived(layout ? figureFrame(layout, figure) : null);

	const baseName = $derived(
		[
			product,
			isolated
				? selectedLabel
				: selectedLabel
					? `superstructure-${selectedLabel}`
					: 'superstructure',
			figure.notation === 'pgraph' ? 'pgraph' : 'block'
		].join('_')
	);
	const figureTitle = $derived(
		isolated && selectedLabel
			? `${selectedLabel} - ${productName}`
			: `Superstructure - ${productName}`
	);
</script>

<svelte:head><title>{productName ? `${productName} · ` : ''}Superstructure</title></svelte:head>

<div class="flex h-screen w-screen flex-col bg-slate-100 text-slate-900">
	<header class="flex h-11 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
		<a href="/" class="text-xs text-slate-500 hover:text-slate-900">← Products</a>
		<span class="h-4 w-px bg-slate-200"></span>
		<h1 class="truncate text-sm font-semibold">{productName.split(', ')[0]}</h1>
		{#if data?.feasible}
			{@const st = data.stats}
			<div class="hidden items-center gap-1.5 text-[11px] text-slate-600 lg:flex">
				<span class={chip} title="Raw materials after augmentation (declared + promoted)">
					|R| {data.raw_materials.declared.length + data.raw_materials.augmented.length}
					{#if data.raw_materials.augmented.length}<span class="text-amber-700"
							>+{data.raw_materials.augmented.length} aug.</span
						>{/if}
				</span>
				<span class={chip} title="Maximal structure μ(S): operating units / materials">
					μ(S) {st.maximal_structure} units · {graph.nodes.filter((n) => n.type === 'material')
						.length} materials
				</span>
				<span class={chip} title="Solution structures S(S) enumerated by SSG"
					>|S(S)| {st.solution_structures}</span
				>
				<span class={chip} title="Combinatorially irreducible pathways Π">|Π| {st.pathways}</span>
				<span class={chip} title="Pathways drawing each energy carrier from one supply"
					>{st.realisable} realisable</span
				>
			</div>
		{/if}
		{#if loading}<span class="text-[11px] text-slate-400">computing…</span>{/if}
		<span class="ml-auto truncate text-[11px] text-slate-400">
			{#if data}{data.provenance.library} v{data.provenance.version} · {data.method}{/if}
		</span>
	</header>

	<div class="flex min-h-0 flex-1">
		<aside class="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
			<RawMaterialList
				{feedstocks}
				{declared}
				{excluded}
				{augment}
				result={data}
				{onfeedstock}
				{onauxiliary}
				onaugment={(on) => {
					augment = on;
					schedule();
				}}
				onhover={hoverMaterial}
			/>
			<PathwayList
				pathways={data?.pathways ?? []}
				structures={data?.structures ?? []}
				categories={data?.categories ?? []}
				{names}
				selectedKey={selection?.key ?? null}
				onselect={(kind, key) => (selection = key ? { kind, key } : null)}
				onhover={(mods) => (hover = mods ? structureHighlight(mods) : null)}
			/>
		</aside>

		<main class="relative min-w-0 flex-1 bg-white">
			<div class="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
				<div
					class="flex gap-0.5 rounded-md bg-white p-0.5 text-[11px] font-medium shadow-sm ring-1 ring-slate-900/10"
				>
					<button
						type="button"
						class="rounded px-2.5 py-1 {!isolated
							? 'bg-slate-900 text-white'
							: 'text-slate-600 hover:text-slate-900'}"
						onclick={() => (isolate = false)}>Superstructure</button
					>
					<button
						type="button"
						class="rounded px-2.5 py-1 disabled:opacity-40 {isolated
							? 'bg-slate-900 text-white'
							: 'text-slate-600 hover:text-slate-900'}"
						disabled={!selectionHighlight}
						onclick={() => (isolate = true)}>{selectedLabel ?? 'Selection'} only</button
					>
				</div>
				{#if selectedLabel}
					<span
						class="flex items-center gap-1.5 rounded-md bg-white py-1 pr-1 pl-2.5 text-[11px] text-slate-700 shadow-sm ring-1 ring-slate-900/10"
					>
						{isolated ? 'Showing' : 'Highlighting'} <b class="font-mono">{selectedLabel}</b>
						<button
							type="button"
							class="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
							title="Clear selection"
							onclick={() => (selection = null)}>✕</button
						>
					</span>
				{/if}
			</div>

			{#if errorMsg}
				<div
					class="absolute top-14 left-3 z-10 max-w-xl rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 shadow-sm ring-1 ring-red-200"
				>
					{errorMsg}
				</div>
			{/if}
			{#if data?.warnings.length}
				<div
					class="absolute right-3 bottom-14 left-3 z-10 mx-auto max-w-2xl space-y-1 rounded-md bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 shadow-sm ring-1 ring-amber-200"
				>
					{#each data.warnings as w (w)}<p>{w}</p>{/each}
				</div>
			{/if}

			{#if data && !data.feasible}
				<div class="absolute inset-0 flex items-center justify-center p-8">
					<div
						class="max-w-md rounded-lg bg-white px-5 py-4 text-sm text-slate-700 shadow ring-1 ring-slate-900/10"
					>
						<p class="font-semibold text-slate-900">No maximal structure exists</p>
						<p class="mt-1.5 text-xs leading-relaxed text-slate-600">
							MSG removed every operating unit that consumes a material which is neither produced
							nor in R, and the product became unreachable. {#if !augment}Turn on augmentation
								(Algorithm 1) or declare the auxiliary inputs in R<sub>init</sub>.{/if}
						</p>
					</div>
				</div>
			{:else if layout && frame}
				<Canvas
					{layout}
					settings={figure}
					{frame}
					highlight={screenHighlight}
					showBounds={tab === 'figure'}
					onnodeenter={nodeEnter}
					onnodeleave={() => {
						hoveredNode = null;
						hover = null;
					}}
					onnodeclick={(id) => {
						pinnedNode = pinnedNode === id ? null : id;
						if (pinnedNode) tab = 'inspect';
					}}
					onbackgroundclick={() => (pinnedNode = null)}
				/>
			{/if}
		</main>

		<aside
			class="flex shrink-0 flex-col border-l border-slate-200 bg-white {tab === 'lca'
				? 'w-[30rem]'
				: 'w-80'}"
		>
			<div class="flex shrink-0 border-b border-slate-200 px-2">
				{#each TABS as t (t.id)}
					<button
						type="button"
						class="-mb-px border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap {tab === t.id
							? 'border-slate-900 text-slate-900'
							: 'border-transparent text-slate-500 hover:text-slate-800'}"
						onclick={() => (tab = t.id)}
					>
						{t.label}
						{#if (t.id === 'inspect' && (pinnedNode || selectedLabel)) || (t.id === 'lca' && selectedPathway)}<span
								class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-900 align-middle"
							></span>{/if}
					</button>
				{/each}
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if tab === 'figure'}
					<FigurePanel
						{frame}
						svg={exportSvg}
						{baseName}
						title={figureTitle}
						hasPathwaySelection={!!selectedPathway?.scaling_factors}
					/>
				{:else if tab === 'lca'}
					{#if dataQuery}
						<LcaSteps
							pathway={selectedPathway}
							structure={selectedStructure}
							query={dataQuery}
							{names}
							{productName}
						/>
					{/if}
				{:else}
					{#if pinnedNode}
						<div
							class="flex items-center justify-between border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500"
						>
							<span>Pinned</span>
							<button
								type="button"
								class="underline hover:text-slate-900"
								onclick={() => (pinnedNode = null)}>Unpin</button
							>
						</div>
					{/if}
					<Inspector
						node={inspectedNode}
						pathway={selectedPathway}
						structure={selectedStructure}
						categories={data?.categories ?? []}
						{terms}
						{names}
						onshowlca={() => {
							pinnedNode = null;
							tab = 'lca';
						}}
					/>
				{/if}
			</div>
		</aside>
	</div>
</div>

<!-- A clean instance for export: no hover state, no pointer handlers. -->
{#if layout && frame}
	<div class="pointer-events-none fixed top-0 -left-25000" aria-hidden="true">
		<Figure {layout} settings={figure} {frame} highlight={exportHighlight} bind:svg={exportSvg} />
	</div>
{/if}
