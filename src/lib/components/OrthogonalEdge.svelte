<script lang="ts">
	import { BaseEdge, type EdgeProps } from '@xyflow/svelte';

	type Props = EdgeProps & {
		data?: { points?: { x: number; y: number }[] };
	};
	let { data, style, markerEnd }: Props = $props();

	const path = $derived.by(() => {
		const pts = data?.points ?? [];
		if (pts.length < 2) return '';
		return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	});
</script>

<BaseEdge {path} {style} {markerEnd} />
