<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { highlight } from '$lib/stores/highlight.svelte';
	import { orientation } from '$lib/stores/orientation.svelte';

	type Props = NodeProps & { data: { label: string; width?: number } };
	let { id, data }: Props = $props();

	const dim = $derived(highlight.active && !highlight.nodeIds.has(id));
	const lit = $derived(highlight.active && highlight.nodeIds.has(id));
	const inPos = $derived(orientation.value === 'horizontal' ? Position.Left : Position.Top);
	const outPos = $derived(orientation.value === 'horizontal' ? Position.Right : Position.Bottom);
</script>

<div
	class="flex h-8 items-center justify-center rounded-sm border bg-slate-900 px-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow transition-all"
	class:border-slate-900={!lit}
	class:border-amber-400={lit}
	class:ring-2={lit}
	class:ring-amber-300={lit}
	style:width="{data.width ?? 160}px"
	style:opacity={dim ? 0.2 : 1}
>
	<Handle type="target" position={inPos} style="opacity:0" />
	<span class="truncate whitespace-nowrap">{data.label}</span>
	<Handle type="source" position={outPos} style="opacity:0" />
</div>
