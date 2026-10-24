<script lang="ts">
	import type { ApiPathway, ApiStructure, GraphNode, ImpactCategory } from '$lib/types';
	import { figure } from '$lib/figure/settings.svelte';

	let {
		node,
		pathway,
		structure,
		categories,
		terms,
		names
	}: {
		node: GraphNode | null;
		pathway: ApiPathway | null;
		structure: ApiStructure | null;
		categories: ImpactCategory[];
		/** Classification term id -> label. */
		terms: Map<string, string>;
		/** Node id -> display name. */
		names: Map<string, string>;
	} = $props();

	const fmt = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });
	const pct = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1
	});
	const head = (id: string) => (names.get(id) ?? id).split(', ')[0];
	const byId = $derived(new Map(categories.map((c) => [c.id, c] as const)));

	function humanize(key: string): string {
		return key.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
	}
	function show(v: unknown): string {
		if (v === null || v === undefined || v === '') return '—';
		if (typeof v === 'number') return fmt.format(v);
		if (typeof v === 'object') return JSON.stringify(v);
		return String(v);
	}

	const roleLabel = $derived.by(() => {
		if (!node) return '';
		if (node.type === 'operation') return 'operating unit';
		return node.role === 'raw' ? 'raw material' : node.role;
	});

	function setLabel(id: string, value: string) {
		const next = { ...figure.labels };
		if (value.trim()) next[id] = value;
		else delete next[id];
		figure.labels = next;
	}
</script>

{#snippet rows(entries: [string, unknown][])}
	<dl class="divide-y divide-slate-100 rounded-md ring-1 ring-slate-900/5">
		{#each entries as [k, v] (k)}
			<div class="flex items-baseline gap-3 px-2.5 py-1.5">
				<dt class="shrink-0 text-[11px] text-slate-500">{k}</dt>
				<dd class="ml-auto min-w-0 text-right text-xs wrap-break-word text-slate-800">{show(v)}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

{#snippet heading(text: string)}
	<h3 class="mt-4 mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
		{text}
	</h3>
{/snippet}

<div class="px-4 py-4">
	{#if node}
		<div class="flex flex-wrap items-center gap-1.5">
			<span
				class="rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase {node.type ===
				'operation'
					? 'bg-slate-900 text-white'
					: 'bg-slate-100 text-slate-700'}">{roleLabel}</span
			>
			{#if node.type === 'material' && node.raw_origin === 'augmented'}
				<span
					class="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-amber-800 uppercase"
					>augmented</span
				>
			{/if}
		</div>
		<h2 class="mt-1.5 text-sm leading-snug font-semibold text-slate-900">{node.label}</h2>
		<p class="mt-0.5 font-mono text-[10px] text-slate-400">{node.id}</p>

		<label class="mt-3 block">
			<span class="text-[11px] font-medium text-slate-500"
				>Figure label <span class="font-normal text-slate-400">(one line per row)</span></span
			>
			<textarea
				rows="2"
				class="mt-0.5 block w-full resize-y rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
				placeholder={node.label.split(', ').join('\n')}
				value={figure.labels[node.id] ?? ''}
				oninput={(e) => setLabel(node!.id, e.currentTarget.value)}
			></textarea>
		</label>

		{#if node.description}
			<p class="mt-3 text-xs leading-relaxed text-slate-600">{node.description}</p>
		{/if}

		{#if node.classification.length}
			{@render heading('Classification · IEA Task 42')}
			<div class="flex flex-wrap gap-1">
				{#each node.classification as t (t)}
					<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700" title={t}
						>{terms.get(t) ?? t}</span
					>
				{/each}
			</div>
		{/if}

		{#if node.type === 'operation'}
			{@render heading('Module')}
			{@render rows([
				['Stage', node.stage],
				['Basis', `${node.basis.quantity} ${node.basis.unit} ${head(node.basis.material)}`],
				['Linking input', node.linking ? head(node.linking.material) : 'none (heads the chain)'],
				[
					'μ′',
					node.linking
						? `${fmt.format(node.linking.mu_prime)} ${node.linking.unit}/${node.basis.unit}`
						: 'undefined'
				]
			])}
			{#if Object.keys(node.utilities).length}
				{@render heading('Utilities')}
				{@render rows(Object.entries(node.utilities).map(([k, v]) => [humanize(k), humanize(v)]))}
			{/if}
			{@render heading('Specific impacts h̃ · per kg basis')}
			{@render rows(
				Object.entries(node.impacts).map(([id, v]) => [
					byId.get(id)?.code ?? id,
					`${fmt.format(v)} ${byId.get(id)?.unit ?? ''}`
				])
			)}
			{#if Object.keys(node.provenance).length}
				{@render heading('Provenance')}
				{@render rows(Object.entries(node.provenance).map(([k, v]) => [humanize(k), v]))}
			{/if}
			{#if Object.keys(node.properties).length}
				{@render heading('Properties')}
				{@render rows(Object.entries(node.properties).map(([k, v]) => [humanize(k), v]))}
			{/if}
		{:else if Object.keys(node.properties).length}
			{@render heading('Properties')}
			{@render rows(Object.entries(node.properties).map(([k, v]) => [humanize(k), v]))}
		{/if}
	{:else if pathway}
		<div class="flex items-center gap-1.5">
			<span
				class="rounded-sm bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase"
				>pathway</span
			>
			{#if pathway.realisable}
				<span
					class="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-700 uppercase"
					>realisable</span
				>
			{:else}
				<span
					class="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
					>mixed utilities</span
				>
			{/if}
		</div>
		<h2 class="mt-1.5 text-sm font-semibold text-slate-900">
			{pathway.id} · {pathway.feedstock ? head(pathway.feedstock) : 'pathway'}
		</h2>

		{#if pathway.impacts}
			{@render heading('Impacts h · per kg product')}
			{@render rows(
				categories.map((c) => [c.code, `${fmt.format(pathway.impacts![c.code])} ${c.unit}`])
			)}
		{/if}

		{#if pathway.scaling_factors && pathway.contributions}
			{@render heading('Chain · scaling s and share of h (%)')}
			<div class="overflow-x-auto rounded-md ring-1 ring-slate-900/5">
				<table class="w-full text-[11px] tabular-nums">
					<thead class="bg-slate-50 text-slate-500">
						<tr>
							<th class="px-1.5 py-1 text-left font-medium">Module</th>
							<th class="px-1 py-1 text-right font-medium">s</th>
							{#each categories as c (c.code)}<th class="px-1 py-1 text-right font-medium"
									>{c.code}</th
								>{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each pathway.modules as slug (slug)}
							<tr>
								<td class="max-w-24 truncate px-1.5 py-1 text-slate-800" title={names.get(slug)}
									>{head(slug)}</td
								>
								<td class="px-1 py-1 text-right text-slate-800"
									>{pathway.scaling_factors[slug].toFixed(2)}</td
								>
								{#each categories as c (c.code)}
									{@const total = pathway.impacts?.[c.code] ?? 0}
									{@const part = pathway.contributions[c.code]?.[slug] ?? 0}
									<td class="px-1 py-1 text-right text-slate-600"
										>{total ? pct.format((part / total) * 100) : '—'}</td
									>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if Object.keys(pathway.utilities).length}
			{@render heading('Utility supply')}
			{@render rows(
				Object.entries(pathway.utilities).map(([k, v]) => [
					humanize(k),
					v.map(humanize).join(' + ')
				])
			)}
		{/if}

		{#if pathway.error}
			<p class="mt-3 text-xs text-amber-700">{pathway.error.detail}</p>
		{/if}
		{#each pathway.warnings as w (w)}
			<p class="mt-3 text-[11px] leading-snug text-amber-700">{w}</p>
		{/each}
	{:else if structure}
		<span
			class="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-slate-600 uppercase"
			>solution structure</span
		>
		<h2 class="mt-1.5 text-sm font-semibold text-slate-900">
			{structure.id}{structure.pathway_id ? ` = ${structure.pathway_id}` : ' · composite'}
		</h2>
		<p class="mt-1 text-xs leading-relaxed text-slate-600">
			{structure.pathway_id
				? 'Combinatorially irreducible: this structure is a process pathway.'
				: 'The union of simpler solution structures: a valid network, but not a distinct route.'}
		</p>
		{@render heading(`Operating units · ${structure.modules.length}`)}
		<ul class="space-y-0.5 text-xs text-slate-700">
			{#each structure.modules as slug (slug)}<li>{names.get(slug) ?? slug}</li>{/each}
		</ul>
	{:else}
		<p class="text-xs leading-relaxed text-slate-500">
			Hover or click a node in the figure to inspect it. Select a pathway or solution structure on
			the left to highlight it; its life-cycle results appear here.
		</p>
	{/if}
</div>
