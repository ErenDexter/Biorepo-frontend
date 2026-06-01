<script lang="ts">
	import type { ApiRawMaterial, ApiSolution } from '$lib/types';
	import { highlight } from '$lib/stores/highlight.svelte';

	let {
		rawMaterials,
		included,
		solutions,
		onToggle
	}: {
		rawMaterials: ApiRawMaterial[];
		included: Set<string>;
		solutions: ApiSolution[];
		onToggle: (id: string, checked: boolean) => void;
	} = $props();

	const GROUP_ORDER = ['raw', 'utility'];
	const GROUP_LABELS: Record<string, string> = {
		raw: 'Feedstocks',
		utility: 'Utilities'
	};

	const groups = $derived.by(() => {
		const map = new Map<string, ApiRawMaterial[]>();
		for (const rm of rawMaterials) {
			const key = rm.kind || 'other';
			const arr = map.get(key);
			if (arr) arr.push(rm);
			else map.set(key, [rm]);
		}
		const orderedKeys = [
			...GROUP_ORDER.filter((k) => map.has(k)),
			...[...map.keys()].filter((k) => !GROUP_ORDER.includes(k)).sort()
		];
		return orderedKeys.map((key) => ({
			key,
			label: GROUP_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
			items: map.get(key)!
		}));
	});

	function highlightFor(id: string) {
		const nodes = new Set<string>();
		const edges = new Set<string>();
		for (const sol of solutions) {
			if (!sol.rawMaterialIds.includes(id)) continue;
			for (const n of sol.nodeIds) nodes.add(n);
			for (const e of sol.edgeIds) edges.add(e);
		}
		if (nodes.size === 0 && edges.size === 0) return;
		highlight.set(nodes, edges);
	}
</script>

<aside
	class="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-4"
>
	<h2 class="mb-3 text-sm font-semibold text-slate-700">Raw materials</h2>
	{#if rawMaterials.length === 0}
		<p class="text-sm text-slate-500">No raw materials feed this product.</p>
	{:else}
		{#each groups as group (group.key)}
			<section class="mb-3">
				<h3 class="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
					{group.label}
				</h3>
				<ul class="space-y-1">
					{#each group.items as rm (rm.id)}
						<li>
							<label
								class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-800 hover:bg-slate-50"
								onmouseenter={() => highlightFor(rm.id)}
								onmouseleave={() => highlight.clear()}
							>
								<input
									type="checkbox"
									class="h-4 w-4 rounded border-slate-300 accent-slate-900 focus:ring-slate-500"
									checked={included.has(rm.id)}
									onchange={(e) => onToggle(rm.id, e.currentTarget.checked)}
								/>
								<span>{rm.name}</span>
							</label>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</aside>
