<script lang="ts">
	import type { FigureFrame, FigureLayout, Highlight, PlacedText } from '$lib/figure/layout';
	import { metrics } from '$lib/figure/layout';
	import type { FigureSettings } from '$lib/figure/settings.svelte';
	import { edgeShape } from '$lib/figure/geometry';
	import { ASCENT, LINE_HEIGHT } from '$lib/figure/text';
	import { FONT_STACK, THEMES, type NodeKind } from '$lib/figure/theme';

	let {
		layout,
		settings,
		frame,
		highlight = null,
		interactive = false,
		svg = $bindable(),
		onnodeenter,
		onnodeleave,
		onnodeclick
	}: {
		layout: FigureLayout;
		settings: FigureSettings;
		frame: FigureFrame;
		highlight?: Highlight | null;
		interactive?: boolean;
		svg?: SVGSVGElement;
		onnodeenter?: (id: string) => void;
		onnodeleave?: (id: string) => void;
		onnodeclick?: (id: string) => void;
	} = $props();

	const m = $derived(metrics(settings));
	const theme = $derived(THEMES[settings.palette]);
	const pgraph = $derived(settings.notation === 'pgraph');
	const vertical = $derived(settings.direction === 'DOWN');
	const r = (v: number) => Math.round(v * 100) / 100;

	const nodeMuted = (id: string) => !!highlight && !highlight.nodes.has(id);
	const edgeMuted = (id: string) => !!highlight && !highlight.edges.has(id);

	// Arcs that share a trunk overlap, so the highlighted ones are painted last.
	const edges = $derived(
		highlight
			? [...layout.edges].sort((a, b) => Number(!edgeMuted(a.id)) - Number(!edgeMuted(b.id)))
			: layout.edges
	);

	function textLines(t: PlacedText, fill: string) {
		let top = t.y;
		return t.lines.map((line) => {
			const size = m.fs * line.scale;
			const baseline = top + size * ASCENT;
			top += size * LINE_HEIGHT;
			return { ...line, size: r(size), x: r(t.x), y: r(baseline), fill };
		});
	}

	function colours(kind: NodeKind, muted: boolean) {
		const swatch = theme.node[kind];
		if (!muted) return { ...swatch, text: theme.text };
		return {
			stroke: theme.muted.stroke,
			fill: pgraph || swatch.fill === '#ffffff' ? '#ffffff' : theme.muted.light,
			mark: swatch.mark === '#ffffff' ? '#ffffff' : theme.muted.fill,
			dashed: swatch.dashed,
			text: theme.muted.text
		};
	}
</script>

{#snippet symbol(kind: NodeKind, x: number, y: number, w: number, h: number, muted: boolean)}
	{@const c = colours(kind, muted)}
	{@const sw = r(m.strokeWidth)}
	{#if pgraph}
		{#if kind === 'operation'}
			<rect x={r(x)} y={r(y)} width={r(w)} height={r(h)} fill={c.mark} />
		{:else if kind === 'raw' || kind === 'raw-aug'}
			{@const pts = vertical
				? `${r(x)},${r(y)} ${r(x + w)},${r(y)} ${r(x + w / 2)},${r(y + h)}`
				: `${r(x)},${r(y)} ${r(x)},${r(y + h)} ${r(x + w)},${r(y + h / 2)}`}
			{#if kind === 'raw'}
				<polygon
					points={pts}
					fill={c.mark}
					stroke={c.mark}
					stroke-width={sw}
					stroke-linejoin="round"
				/>
			{:else}
				<polygon
					points={pts}
					fill="#ffffff"
					stroke={c.stroke}
					stroke-width={sw}
					stroke-linejoin="round"
				/>
			{/if}
		{:else if kind === 'product'}
			<circle
				cx={r(x + w / 2)}
				cy={r(y + h / 2)}
				r={r(w / 2)}
				fill="#ffffff"
				stroke={c.stroke}
				stroke-width={r(sw * 1.2)}
			/>
			<circle cx={r(x + w / 2)} cy={r(y + h / 2)} r={r(w * 0.24)} fill={c.mark} />
		{:else if kind === 'byproduct'}
			<circle
				cx={r(x + w / 2)}
				cy={r(y + h / 2)}
				r={r(w / 2 - sw / 2)}
				fill="#ffffff"
				stroke={c.stroke}
				stroke-width={sw}
			/>
		{:else}
			<circle cx={r(x + w / 2)} cy={r(y + h / 2)} r={r(w / 2)} fill={c.mark} />
		{/if}
	{:else if kind === 'operation'}
		<rect
			x={r(x)}
			y={r(y)}
			width={r(w)}
			height={r(h)}
			rx={r(m.fs * 0.12)}
			fill={c.fill}
			stroke={c.stroke}
			stroke-width={r(sw * 1.1)}
		/>
	{:else}
		<rect
			x={r(x)}
			y={r(y)}
			width={r(w)}
			height={r(h)}
			rx={r(h / 2)}
			fill={c.fill}
			stroke={c.stroke}
			stroke-width={r(kind === 'product' ? sw * 1.9 : sw)}
			stroke-dasharray={c.dashed ? `${r(m.fs * 0.3)} ${r(m.fs * 0.18)}` : undefined}
		/>
	{/if}
{/snippet}

{#snippet text(t: PlacedText, fill: string, qualifierFill: string)}
	{#each textLines(t, fill) as line, i (i)}
		<text
			x={line.x}
			y={line.y}
			font-size={line.size}
			font-style={line.italic ? 'italic' : undefined}
			text-anchor={t.anchor === 'middle' ? 'middle' : undefined}
			fill={line.italic ? qualifierFill : line.fill}>{line.text}</text
		>
	{/each}
{/snippet}

<svg
	bind:this={svg}
	xmlns="http://www.w3.org/2000/svg"
	viewBox={frame.viewBox.map(r).join(' ')}
	width={r(frame.viewBox[2])}
	height={r(frame.viewBox[3])}
	font-family={FONT_STACK[settings.font]}
>
	{#if !settings.transparent}
		<rect
			x={r(frame.viewBox[0])}
			y={r(frame.viewBox[1])}
			width={r(frame.viewBox[2])}
			height={r(frame.viewBox[3])}
			fill="#ffffff"
		/>
	{/if}

	<g fill="none" stroke-linecap="butt" stroke-linejoin="round">
		{#each edges as edge (edge.id)}
			{@const muted = edgeMuted(edge.id)}
			{@const emphasised = !!highlight && !muted}
			{@const shape = edgeShape(
				edge.points,
				edge.spline,
				settings.edgeStyle,
				m.arrowLength,
				m.arrowWidth,
				m.cornerRadius
			)}
			{@const colour = muted ? theme.muted.stroke : theme.edge}
			<path d={shape.d} stroke={colour} stroke-width={r(m.edgeWidth * (emphasised ? 1.45 : 1))} />
			<polygon points={shape.arrow} fill={colour} stroke="none" />
		{/each}
	</g>

	{#each layout.nodes as node (node.id)}
		{@const muted = nodeMuted(node.id)}
		{@const c = colours(node.kind, muted)}
		<g
			role={interactive ? 'button' : undefined}
			data-node={interactive ? node.id : undefined}
			onpointerenter={interactive ? () => onnodeenter?.(node.id) : undefined}
			onpointerleave={interactive ? () => onnodeleave?.(node.id) : undefined}
			onclick={interactive ? () => onnodeclick?.(node.id) : undefined}
			style={interactive ? 'cursor:pointer' : undefined}
		>
			{#if interactive}
				{@const lx =
					node.label.anchor === 'middle' ? node.label.x - node.label.width / 2 : node.label.x}
				{@const x0 = Math.min(node.x, lx)}
				{@const y0 = Math.min(node.y, node.label.y)}
				<rect
					x={x0 - 2}
					y={y0 - 2}
					width={Math.max(node.x + node.w, lx + node.label.width) - x0 + 4}
					height={Math.max(node.y + node.h, node.label.y + node.label.height) - y0 + 4}
					fill="transparent"
				/>
			{/if}
			{@render symbol(node.kind, node.x, node.y, node.w, node.h, muted)}
			{@render text(node.label, c.text, muted ? theme.muted.text : theme.qualifier)}
		</g>
	{/each}

	{#each layout.legend as item (item.kind)}
		{@render symbol(item.kind, item.x, item.y, item.w, item.h, false)}
		{@render text(item.text, theme.text, theme.qualifier)}
	{/each}
</svg>
