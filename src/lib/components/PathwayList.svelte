<script lang="ts">
	import type { ApiPathway, ApiStructure, ImpactCategory } from '$lib/types';

	let {
		pathways,
		structures,
		categories,
		names,
		selectedKey,
		onselect,
		onhover
	}: {
		pathways: ApiPathway[];
		structures: ApiStructure[];
		categories: ImpactCategory[];
		/** Material slug -> display name. */
		names: Map<string, string>;
		selectedKey: string | null;
		onselect: (kind: 'pathway' | 'structure', key: string | null) => void;
		onhover: (modules: string[] | null) => void;
	} = $props();

	let tab = $state<'pathways' | 'structures'>('pathways');
	let realisableOnly = $state(false);

	const shown = $derived(realisableOnly ? pathways.filter((p) => p.realisable) : pathways);
	const fmt = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 });
	const head = (slug: string | null) => (slug ? (names.get(slug) ?? slug).split(', ')[0] : '—');

	function toggle(kind: 'pathway' | 'structure', key: string) {
		onselect(kind, selectedKey === key ? null : key);
	}
</script>

<section class="flex min-h-0 flex-1 flex-col border-t border-slate-200">
	<div class="flex items-center gap-1 px-4 pt-3 pb-2">
		<button
			type="button"
			class="rounded px-2 py-1 text-xs font-medium"
			class:bg-slate-900={tab === 'pathways'}
			class:text-white={tab === 'pathways'}
			class:text-slate-600={tab !== 'pathways'}
			onclick={() => (tab = 'pathways')}
			>Pathways <span class="opacity-60">{pathways.length}</span></button
		>
		<button
			type="button"
			class="rounded px-2 py-1 text-xs font-medium"
			class:bg-slate-900={tab === 'structures'}
			class:text-white={tab === 'structures'}
			class:text-slate-600={tab !== 'structures'}
			onclick={() => (tab = 'structures')}
			>Solution structures <span class="opacity-60">{structures.length}</span></button
		>
	</div>

	{#if tab === 'pathways'}
		<div class="flex items-center justify-between px-4 pb-2">
			<label class="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
				<input
					type="checkbox"
					class="h-3 w-3 accent-slate-900"
					bind:checked={realisableOnly}
				/>Realisable only
			</label>
			{#if categories.length}
				<span class="text-[10px] text-slate-400">per kg product</span>
			{/if}
		</div>
		<ul class="min-h-0 flex-1 overflow-y-auto px-2 pb-3" onmouseleave={() => onhover(null)}>
			{#each shown as p (p.key)}
				{@const active = selectedKey === p.key}
				<li>
					<button
						type="button"
						class="w-full rounded-md px-2 py-1.5 text-left transition-colors {active
							? 'bg-slate-900 text-white'
							: 'text-slate-800 hover:bg-slate-100'}"
						onclick={() => toggle('pathway', p.key)}
						onmouseenter={() => onhover(p.modules)}
					>
						<div class="flex items-center gap-2 text-xs">
							<span class="font-mono text-[11px] font-semibold">{p.id}</span>
							<span class="min-w-0 flex-1 truncate">{head(p.feedstock)}</span>
							{#if p.realisable}
								<span
									class="rounded-sm px-1 text-[9px] font-semibold tracking-wide uppercase {active
										? 'bg-emerald-400/20 text-emerald-200'
										: 'bg-emerald-50 text-emerald-700'}">realisable</span
								>
							{/if}
						</div>
						{#if p.impacts}
							<div
								class="mt-0.5 grid grid-cols-4 gap-1 text-[10px] tabular-nums {active
									? 'text-slate-300'
									: 'text-slate-500'}"
							>
								{#each categories as c (c.code)}
									<span title="{c.name} ({c.unit})"
										><span class="opacity-60">{c.code}</span> {fmt.format(p.impacts[c.code])}</span
									>
								{/each}
							</div>
						{:else if p.error}
							<div class="mt-0.5 truncate text-[10px] text-amber-600" title={p.error.detail}>
								{p.error.code}
							</div>
						{/if}
					</button>
				</li>
			{:else}
				<li class="px-2 py-2 text-xs text-slate-400">No pathways.</li>
			{/each}
		</ul>
	{:else}
		<p class="px-4 pb-2 text-[11px] leading-snug text-slate-500">
			Every network SSG enumerates. Composites are unions of pathways and are not distinct routes.
		</p>
		<ul class="min-h-0 flex-1 overflow-y-auto px-2 pb-3" onmouseleave={() => onhover(null)}>
			{#each structures as s (s.key)}
				{@const active = selectedKey === s.key}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors {active
							? 'bg-slate-900 text-white'
							: 'text-slate-800 hover:bg-slate-100'}"
						onclick={() => toggle('structure', s.key)}
						onmouseenter={() => onhover(s.modules)}
					>
						<span class="font-mono text-[11px] font-semibold">{s.id}</span>
						<span class="flex-1 {active ? 'text-slate-300' : 'text-slate-500'}"
							>{s.modules.length} units</span
						>
						{#if s.pathway_id}
							<span class="font-mono text-[10px] {active ? 'text-emerald-200' : 'text-emerald-700'}"
								>= {s.pathway_id}</span
							>
						{:else}
							<span class="text-[10px] {active ? 'text-slate-400' : 'text-slate-400'}"
								>composite</span
							>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
