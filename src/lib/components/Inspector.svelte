<script lang="ts">
	import type { GraphNode } from '$lib/types';

	let { node }: { node: GraphNode | null } = $props();

	function humanize(key: string): string {
		return key
			.replace(/[_-]+/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function formatValue(v: unknown): string {
		if (v === null || v === undefined) return '—';
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		return JSON.stringify(v);
	}

	function entries(v: unknown): [string, unknown][] {
		if (!v || typeof v !== 'object') return [];
		return Object.entries(v as Record<string, unknown>);
	}

	const kindLabel = $derived(
		node ? (node.type === 'material' ? (node.kind ?? 'material') : 'operation') : ''
	);
</script>

<aside
	class="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white"
>
	{#if !node}
		<p class="p-4 text-sm text-slate-500">Hover a node to inspect it.</p>
	{:else}
		<header class="border-b border-slate-100 px-4 pt-4 pb-3">
			<div class="flex items-center gap-2">
				<span
					class="inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
					class:bg-slate-900={node.type === 'operation'}
					class:text-white={node.type === 'operation'}
					class:bg-slate-100={node.type === 'material'}
					class:text-slate-700={node.type === 'material'}
				>
					{kindLabel}
				</span>
				{#if node.isPlatform}
					<span
						class="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800"
					>platform</span>
				{/if}
			</div>
			<h2 class="mt-1.5 text-base leading-tight font-semibold text-slate-900">
				{node.label}
			</h2>
		</header>

		<div class="flex-1 px-4 py-3">
			{#each Object.entries(node.data ?? {}) as [section, value] (section)}
				{@const rows = entries(value)}
				{#if rows.length > 0}
					<section class="mb-4 last:mb-0">
						<h3 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
							{humanize(section)}
						</h3>
						<dl class="divide-y divide-slate-100 rounded-md border border-slate-100">
							{#each rows as [k, v] (k)}
								<div class="flex items-baseline gap-3 px-2.5 py-1.5">
									<dt class="min-w-0 shrink-0 text-[11px] font-medium text-slate-500">
										{humanize(k)}
									</dt>
									<dd class="ml-auto min-w-0 text-right text-xs wrap-break-word text-slate-800">
										{formatValue(v)}
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}
			{:else}
				<p class="text-sm text-slate-400">No properties.</p>
			{/each}
		</div>
	{/if}
</aside>
