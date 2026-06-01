<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { orientation } from '$lib/stores/orientation.svelte';
	import type { GraphNodeKind } from '$lib/types';

	type Props = NodeProps & {
		data: {
			label: string;
			kind?: GraphNodeKind;
			isPlatform?: boolean;
			width?: number;
		};
	};
	let { id, data }: Props = $props();

	const kindStyles: Record<string, string> = {
		raw: 'bg-emerald-50 border-emerald-500 text-emerald-900',
		intermediate: 'bg-white border-slate-400 text-slate-800',
		platform: 'bg-amber-50 border-amber-500 text-amber-900',
		product: 'bg-indigo-50 border-indigo-500 text-indigo-900',
		utility: 'bg-sky-50 border-sky-400 text-sky-900',
		byproduct: 'bg-stone-50 border-stone-400 text-stone-700',
		waste: 'bg-rose-50 border-rose-400 text-rose-800'
	};
	const cls = $derived(kindStyles[data.kind ?? 'intermediate'] ?? kindStyles.intermediate);
	const dim = $derived(highlight.active && !highlight.nodeIds.has(id));
	const lit = $derived(highlight.active && highlight.nodeIds.has(id));
	const inPos = $derived(orientation.value === 'horizontal' ? Position.Left : Position.Top);
	const outPos = $derived(orientation.value === 'horizontal' ? Position.Right : Position.Bottom);
</script>

<div
	class="flex h-8 items-center justify-center rounded-full border-2 px-3 text-xs font-medium shadow-sm transition-all {cls}"
	class:ring-2={lit}
	class:ring-amber-400={lit}
	style:width="{data.width ?? 160}px"
	style:opacity={dim ? 0.2 : 1}
>
	<Handle type="target" position={inPos} style="opacity:0" />
	<span class="truncate whitespace-nowrap">{data.label}</span>
	{#if data.isPlatform}
		<span
			class="ml-1.5 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
		>platform</span>
	{/if}
	<Handle type="source" position={outPos} style="opacity:0" />
</div>
