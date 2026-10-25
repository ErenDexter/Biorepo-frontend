<script lang="ts">
	import { untrack } from 'svelte';
	import Figure from './Figure.svelte';
	import type { FigureFrame, FigureLayout, Highlight } from '$lib/figure/layout';
	import type { FigureSettings } from '$lib/figure/settings.svelte';

	let {
		layout,
		settings,
		frame,
		highlight,
		showBounds = false,
		onnodeenter,
		onnodeleave,
		onnodeclick,
		onbackgroundclick
	}: {
		layout: FigureLayout;
		settings: FigureSettings;
		frame: FigureFrame;
		highlight: Highlight | null;
		/** Outline the export crop. Otherwise the figure sits on one seamless canvas. */
		showBounds?: boolean;
		onnodeenter: (id: string) => void;
		onnodeleave: (id: string) => void;
		onnodeclick: (id: string) => void;
		/** A click on empty canvas, not on a node and not at the end of a drag. */
		onbackgroundclick: () => void;
	} = $props();

	let cw = $state(0);
	let ch = $state(0);
	let zoom = $state(1);
	let tx = $state(0);
	let ty = $state(0);

	const vw = $derived(frame.viewBox[2]);
	const vh = $derived(frame.viewBox[3]);

	// Room left free for the toolbar above and the zoom controls below.
	const TOP = 56;
	const BOTTOM = 52;
	const SIDE = 28;

	function fit() {
		if (!cw || !ch || !vw || !vh) return;
		const z = Math.min((cw - 2 * SIDE) / vw, (ch - TOP - BOTTOM) / vh, 4);
		zoom = z;
		tx = (cw - vw * z) / 2;
		ty = TOP + (ch - TOP - BOTTOM - vh * z) / 2;
	}

	// Refit whenever the drawing changes size or the viewport does -- and only
	// then: the fit itself must not depend on the zoom it sets, or every zoom
	// the user makes would be undone at once.
	$effect(() => {
		void [vw, vh, cw, ch];
		untrack(fit);
	});

	function zoomAt(factor: number, px = cw / 2, py = ch / 2) {
		const next = Math.min(Math.max(zoom * factor, 0.1), 12);
		tx = px - (px - tx) * (next / zoom);
		ty = py - (py - ty) * (next / zoom);
		zoom = next;
	}

	function onwheel(e: WheelEvent) {
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
	}

	let drag: { x: number; y: number; tx: number; ty: number } | null = null;
	let dragged = false;

	function onpointerdown(e: PointerEvent) {
		if (e.button !== 0) return;
		drag = { x: e.clientX, y: e.clientY, tx, ty };
		dragged = false;
	}
	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!dragged && Math.hypot(dx, dy) > 3) {
			dragged = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		}
		if (dragged) {
			tx = drag.tx + dx;
			ty = drag.ty + dy;
		}
	}
	function onpointerup() {
		drag = null;
	}
</script>

<div
	class="relative h-full w-full cursor-grab touch-none overflow-hidden bg-white select-none active:cursor-grabbing"
	bind:clientWidth={cw}
	bind:clientHeight={ch}
	{onwheel}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
	onclick={(e) => {
		const target = e.target as Element;
		if (!dragged && !target.closest('[data-node], [data-controls]')) onbackgroundclick();
	}}
	role="presentation"
>
	<div
		class="absolute top-0 left-0 origin-top-left"
		style:transform="translate({tx}px, {ty}px) scale({zoom})"
	>
		<div
			class="artboard"
			class:checker={showBounds && settings.transparent}
			style:width="{vw}px"
			style:height="{vh}px"
			style:outline={showBounds ? `${1 / zoom}px dashed #cbd5e1` : undefined}
		>
			<Figure
				{layout}
				{settings}
				{frame}
				{highlight}
				interactive
				{onnodeenter}
				{onnodeleave}
				onnodeclick={(id) => {
					if (!dragged) onnodeclick(id);
				}}
			/>
		</div>
	</div>

	<div
		data-controls
		class="absolute right-3 bottom-3 flex items-center overflow-hidden rounded-md border border-slate-200 bg-white/95 text-xs text-slate-600 shadow-sm backdrop-blur"
	>
		<button
			type="button"
			class="px-2.5 py-1.5 hover:bg-slate-50"
			onclick={() => zoomAt(1 / 1.25)}
			title="Zoom out">−</button
		>
		<span class="w-12 border-x border-slate-200 py-1.5 text-center tabular-nums"
			>{Math.round(zoom * 100)}%</span
		>
		<button
			type="button"
			class="px-2.5 py-1.5 hover:bg-slate-50"
			onclick={() => zoomAt(1.25)}
			title="Zoom in">+</button
		>
		<button
			type="button"
			class="border-l border-slate-200 px-2.5 py-1.5 hover:bg-slate-50"
			onclick={fit}>Fit</button
		>
	</div>
</div>

<style>
	.checker {
		background-color: #fff;
		background-image:
			linear-gradient(45deg, #eef0f3 25%, transparent 25%),
			linear-gradient(-45deg, #eef0f3 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #eef0f3 75%),
			linear-gradient(-45deg, transparent 75%, #eef0f3 75%);
		background-size: 12px 12px;
		background-position:
			0 0,
			0 6px,
			6px -6px,
			-6px 0;
	}
	.artboard :global(svg) {
		display: block;
	}
</style>
