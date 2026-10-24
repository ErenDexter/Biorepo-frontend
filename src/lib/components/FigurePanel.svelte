<script lang="ts">
	import {
		COLUMN_WIDTHS,
		DPI_CHOICES,
		MIN_PRINT_PT,
		figure,
		resetFigureSettings,
		type Direction,
		type EdgeStyle,
		type FontFamily,
		type Notation,
		type Palette
	} from '$lib/figure/settings.svelte';
	import type { FigureFrame } from '$lib/figure/layout';
	import { exportPdf, exportPng, exportSvg, exportTiff, pixelSize } from '$lib/figure/export';

	let {
		frame,
		svg,
		baseName,
		title,
		hasPathwaySelection
	}: {
		frame: FigureFrame | null;
		svg: SVGSVGElement | undefined;
		baseName: string;
		title: string;
		hasPathwaySelection: boolean;
	} = $props();

	let busy = $state<string | null>(null);
	let message = $state<{ ok: boolean; text: string } | null>(null);

	const size = $derived(frame ? { widthPt: frame.widthPt, heightPt: frame.heightPt } : null);
	const px = $derived(size ? pixelSize(size, figure.dpi) : null);
	const tooSmall = $derived(!!frame && frame.printedFontPt < MIN_PRINT_PT - 0.05);
	const tooTall = $derived(!!frame && frame.heightMm > 240);
	const customWidth = $derived(
		figure.widthMm !== null && !COLUMN_WIDTHS.some((c) => c.value === figure.widthMm)
	);
	const labelCount = $derived(Object.keys(figure.labels).length);

	async function run(format: 'pdf' | 'svg' | 'png' | 'tiff') {
		if (!svg || !size) return;
		busy = format;
		message = null;
		const name = `${baseName}.${format === 'tiff' ? 'tif' : format}`;
		try {
			if (format === 'pdf') await exportPdf(svg, size, figure.font, title, name);
			else if (format === 'svg') exportSvg(svg, size, name);
			else if (format === 'png') await exportPng(svg, size, figure.dpi, figure.transparent, name);
			else await exportTiff(svg, size, figure.dpi, name);
			message = { ok: true, text: `Saved ${name}` };
		} catch (e) {
			message = { ok: false, text: e instanceof Error ? e.message : String(e) };
		} finally {
			busy = null;
		}
	}

	const seg =
		'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors text-slate-600 hover:text-slate-900';
	const segOn = 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/10';

	const heading = 'text-[10px] font-semibold tracking-wider text-slate-400 uppercase';
	const input =
		'mt-0.5 block w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-slate-400 focus:outline-none';
	const check =
		'flex cursor-pointer items-center gap-2 text-xs text-slate-700 [&>input]:h-3.5 [&>input]:w-3.5 [&>input]:accent-slate-900';
	const btnBase =
		'flex items-baseline justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
	const btn = `${btnBase} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`;
	const btnPrimary = `${btnBase} bg-slate-900 text-white hover:bg-slate-800`;
	const btnSub = 'text-[10px] font-normal opacity-60';
</script>

{#snippet segmented(
	value: string,
	options: { value: string; label: string }[],
	set: (v: string) => void
)}
	<div class="flex gap-0.5 rounded-md bg-slate-100 p-0.5">
		{#each options as o (o.label)}
			<button
				type="button"
				class="{seg} {value === o.value ? segOn : ''}"
				onclick={() => set(o.value)}
			>
				{o.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet row(label: string)}
	<span class="text-[11px] font-medium text-slate-500">{label}</span>
{/snippet}

<div class="space-y-5 px-4 py-4 text-sm">
	<section class="space-y-2.5">
		<h3 class={heading}>Notation</h3>
		{@render segmented(
			figure.notation,
			[
				{ value: 'pgraph', label: 'P-graph' },
				{ value: 'block', label: 'Block diagram' }
			],
			(v) => (figure.notation = v as Notation)
		)}
		{@render segmented(
			figure.palette,
			[
				{ value: 'mono', label: 'Monochrome' },
				{ value: 'colour', label: 'Colour' }
			],
			(v) => (figure.palette = v as Palette)
		)}
	</section>

	<section class="space-y-2.5">
		<h3 class={heading}>Layout</h3>
		{@render segmented(
			figure.direction,
			[
				{ value: 'DOWN', label: '↓ Top-down' },
				{ value: 'RIGHT', label: '→ Left-right' }
			],
			(v) => (figure.direction = v as Direction)
		)}
		{@render segmented(
			figure.edgeStyle,
			[
				{ value: 'orthogonal', label: 'Orthogonal' },
				{ value: 'rounded', label: 'Rounded' },
				{ value: 'spline', label: 'Curved' }
			],
			(v) => (figure.edgeStyle = v as EdgeStyle)
		)}
		<label class="block">
			<div class="flex justify-between">
				{@render row('Spacing')}<span class="text-[11px] text-slate-400 tabular-nums"
					>×{figure.spacing.toFixed(2)}</span
				>
			</div>
			<input
				type="range"
				min="0.5"
				max="2"
				step="0.05"
				bind:value={figure.spacing}
				class="w-full accent-slate-900"
			/>
		</label>
	</section>

	<section class="space-y-2.5">
		<h3 class={heading}>Text</h3>
		{@render segmented(
			figure.font,
			[
				{ value: 'sans', label: 'Arial / Helvetica' },
				{ value: 'serif', label: 'Times' }
			],
			(v) => (figure.font = v as FontFamily)
		)}
		<div class="grid grid-cols-2 gap-3">
			<label class="block">
				{@render row('Size (pt)')}
				<input
					type="number"
					min="5"
					max="14"
					step="0.5"
					bind:value={figure.fontSize}
					class={input}
				/>
			</label>
			<label class="block">
				{@render row('Wrap (chars)')}
				<input type="number" min="8" max="80" step="1" bind:value={figure.wrap} class={input} />
			</label>
		</div>
		<label class={check}
			><input type="checkbox" bind:checked={figure.operationQualifiers} />Operating-unit qualifier
			(energy supply)</label
		>
		<label class={check}
			><input type="checkbox" bind:checked={figure.materialQualifiers} />Material qualifier (grade,
			purity)</label
		>
	</section>

	<section class="space-y-2">
		<h3 class={heading}>Content</h3>
		<label class={check}><input type="checkbox" bind:checked={figure.legend} />Legend</label>
		<label class={check}
			><input type="checkbox" bind:checked={figure.markAugmented} />Distinguish augmented raw
			materials</label
		>
		<label class="{check} {hasPathwaySelection ? '' : 'opacity-50'}">
			<input type="checkbox" bind:checked={figure.annotateScaling} /><span
				>Scaling factors <i>s</i> on selected pathway</span
			>
		</label>
		{#if labelCount > 0}
			<button
				type="button"
				class="text-[11px] text-slate-500 underline hover:text-slate-800"
				onclick={() => (figure.labels = {})}
			>
				Clear {labelCount} custom label{labelCount === 1 ? '' : 's'}
			</button>
		{/if}
	</section>

	<section class="space-y-2.5">
		<h3 class={heading}>Page</h3>
		<label class="block">
			{@render row('Width')}
			<select
				class={input}
				value={customWidth ? 'custom' : String(figure.widthMm)}
				onchange={(e) => {
					const v = e.currentTarget.value;
					figure.widthMm =
						v === 'null'
							? null
							: v === 'custom'
								? frame
									? Math.round(frame.widthMm)
									: 120
								: Number(v);
				}}
			>
				{#each COLUMN_WIDTHS as c (c.label)}
					<option value={String(c.value)}>{c.label}</option>
				{/each}
				<option value="custom">Custom…</option>
			</select>
		</label>
		<div class="grid grid-cols-2 gap-3">
			{#if customWidth}
				<label class="block">
					{@render row('Width (mm)')}
					<input
						type="number"
						min="20"
						max="400"
						step="1"
						bind:value={figure.widthMm}
						class={input}
					/>
				</label>
			{/if}
			<label class="block">
				{@render row('Margin (mm)')}
				<input
					type="number"
					min="0"
					max="20"
					step="0.5"
					bind:value={figure.marginMm}
					class={input}
				/>
			</label>
		</div>
		{#if frame}
			<dl
				class="space-y-1 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-900/5"
			>
				<div class="flex justify-between">
					<dt>Printed size</dt>
					<dd class="tabular-nums">{frame.widthMm.toFixed(1)} × {frame.heightMm.toFixed(1)} mm</dd>
				</div>
				<div class="flex justify-between">
					<dt>Printed text</dt>
					<dd class="tabular-nums" class:text-amber-700={tooSmall} class:font-semibold={tooSmall}>
						{frame.printedFontPt.toFixed(1)} pt
					</dd>
				</div>
				<div class="flex justify-between">
					<dt>Natural width</dt>
					<dd class="tabular-nums">{frame.naturalWidthMm.toFixed(1)} mm</dd>
				</div>
			</dl>
			{#if tooSmall}
				<p class="text-[11px] leading-snug text-amber-700">
					Text prints below the {MIN_PRINT_PT} pt journals require. Raise the font size, tighten spacing,
					wrap labels shorter or switch direction.
				</p>
			{/if}
			{#if tooTall}
				<p class="text-[11px] leading-snug text-amber-700">
					Taller than a 240 mm page body; try left-right layout.
				</p>
			{/if}
		{/if}
	</section>

	<section class="space-y-2.5">
		<h3 class={heading}>Export</h3>
		<div class="grid grid-cols-2 gap-2">
			<button type="button" class={btnPrimary} disabled={!!busy || !svg} onclick={() => run('pdf')}>
				{busy === 'pdf' ? 'Saving…' : 'PDF'}<span class={btnSub}>vector</span>
			</button>
			<button type="button" class={btn} disabled={!!busy || !svg} onclick={() => run('svg')}>
				{busy === 'svg' ? 'Saving…' : 'SVG'}<span class={btnSub}>vector</span>
			</button>
		</div>
		<label class="block">
			{@render row('Raster resolution')}
			<select class={input} bind:value={figure.dpi}>
				{#each DPI_CHOICES as d (d)}
					<option value={d}
						>{d} dpi{d === 1000 ? ' — line art (Elsevier)' : d === 300 ? ' — minimum' : ''}</option
					>
				{/each}
			</select>
		</label>
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class={btn}
				disabled={!!busy || !svg || !px?.fits}
				onclick={() => run('png')}
			>
				{busy === 'png' ? 'Rendering…' : 'PNG'}<span class={btnSub}>{figure.dpi} dpi</span>
			</button>
			<button
				type="button"
				class={btn}
				disabled={!!busy || !svg || !px?.fits}
				onclick={() => run('tiff')}
			>
				{busy === 'tiff' ? 'Rendering…' : 'TIFF'}<span class={btnSub}>{figure.dpi} dpi</span>
			</button>
		</div>
		{#if px}
			<p class="text-[11px] text-slate-500 tabular-nums">
				{px.width.toLocaleString()} × {px.height.toLocaleString()} px{#if !px.fits}<span
						class="text-amber-700"
					>
						— too large for a canvas; lower the dpi</span
					>{/if}
			</p>
		{/if}
		<label class={check}
			><input type="checkbox" bind:checked={figure.transparent} />Transparent background (PNG, SVG)</label
		>
		{#if message}
			<p
				class="text-[11px] wrap-break-word"
				class:text-emerald-700={message.ok}
				class:text-red-700={!message.ok}
			>
				{message.text}
			</p>
		{/if}
	</section>

	<button
		type="button"
		class="text-[11px] text-slate-400 underline hover:text-slate-700"
		onclick={() => resetFigureSettings()}
	>
		Reset figure settings
	</button>
</div>
