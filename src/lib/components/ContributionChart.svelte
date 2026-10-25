<script lang="ts">
	// Share of each impact category contributed by each module of the chain:
	// one 100%-stacked bar per category, one segment per module, chain order.

	interface Series {
		id: string;
		label: string;
	}
	interface Row {
		code: string;
		name: string;
		unit: string;
		/** h_k, the category total. */
		total: number;
		/** h~_kj * s_j per module id. */
		parts: Record<string, number>;
	}

	let { series, rows }: { series: Series[]; rows: Row[] } = $props();

	// Categorical slots in fixed order, so module j keeps its colour in every
	// pathway. Validated on the white panel (dataviz validate_palette.js): CVD
	// and normal-vision separation pass for adjacent pairs; slots 3-5 are below
	// 3:1, so values also appear as labels and in the table beneath.
	const SLOTS = [
		'#2a78d6',
		'#eb6834',
		'#1baf7a',
		'#eda100',
		'#e87ba4',
		'#008300',
		'#6250d6',
		'#e34948'
	];
	const OTHER = '#898781';
	const inkOn = (hex: string) => (hex === '#eda100' ? '#0b0b0b' : '#ffffff');

	// Past eight modules the tail folds into "Other" instead of a generated hue.
	const keys = $derived.by(() => {
		if (series.length <= SLOTS.length) {
			return series.map((s, i) => ({
				label: s.label,
				ids: [s.id],
				color: SLOTS[i],
				n: `${i + 1}`
			}));
		}
		const head = series.slice(0, SLOTS.length - 1);
		return [
			...head.map((s, i) => ({ label: s.label, ids: [s.id], color: SLOTS[i], n: `${i + 1}` })),
			{ label: 'Other', ids: series.slice(head.length).map((s) => s.id), color: OTHER, n: '' }
		];
	});

	const LABEL_W = 34;
	const BAR_H = 14;
	const ROW_H = 24;
	const GAP = 2;
	const AXIS_H = 16;
	const RADIUS = 4;

	let width = $state(0);
	const plotW = $derived(Math.max(0, width - LABEL_W - 4));
	const height = $derived(rows.length * ROW_H + AXIS_H);

	const pctFmt = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});
	const valFmt = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });

	const bars = $derived(
		rows.map((row, r) => {
			const values = keys.map((k) => k.ids.reduce((sum, id) => sum + (row.parts[id] ?? 0), 0));
			// Geometry uses positive parts only; a credit would not fit a 100% stack.
			const drawn = values.map((v) => Math.max(0, v));
			const sum = drawn.reduce((a, b) => a + b, 0) || 1;
			const count = drawn.filter((v) => v > 0).length;
			const avail = Math.max(0, plotW - GAP * Math.max(0, count - 1));
			const y = r * ROW_H + (ROW_H - BAR_H) / 2;
			let x = LABEL_W;
			const segs: { key: number; x: number; w: number; value: number; share: number }[] = [];
			drawn.forEach((v, key) => {
				if (v <= 0) return;
				const w = (v / sum) * avail;
				segs.push({
					key,
					x,
					w,
					value: values[key],
					share: row.total ? (values[key] / row.total) * 100 : 0
				});
				x += w + GAP;
			});
			const largest = segs.reduce((a, b) => (b.w > (a?.w ?? -1) ? b : a), segs[0]);
			return { row, y, segs, largest };
		})
	);

	/** A rectangle with only its right-hand corners rounded: the bar's data end. */
	function endPath(x: number, y: number, w: number, h: number): string {
		const r = Math.min(RADIUS, w, h / 2);
		return `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z`;
	}

	let tip = $state<{
		x: number;
		y: number;
		key: number;
		code: string;
		share: number;
		value: number;
		unit: string;
	} | null>(null);
	function show(
		e: { clientX: number; clientY: number } | null,
		el: Element,
		seg: (typeof bars)[number]['segs'][number],
		row: Row
	) {
		const box = el.closest('[data-chart]')!.getBoundingClientRect();
		const at =
			e ??
			(() => {
				const b = el.getBoundingClientRect();
				return { clientX: b.left + b.width / 2, clientY: b.top };
			})();
		tip = {
			x: Math.min(Math.max(at.clientX - box.left, 70), box.width - 70),
			y: at.clientY - box.top,
			key: seg.key,
			code: row.code,
			share: seg.share,
			value: seg.value,
			unit: row.unit
		};
	}
</script>

<div class="relative" data-chart>
	<ul class="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-slate-600">
		{#each keys as k (k.label)}
			<li class="flex items-center gap-1.5">
				<span class="h-2 w-2 shrink-0 rounded-[2px]" style="background: {k.color}"></span>
				{#if k.n}<span class="text-slate-400">{k.n}</span>{/if}{k.label}
			</li>
		{/each}
	</ul>

	<div bind:clientWidth={width}>
		{#if width > 0}
			<svg
				{width}
				{height}
				class="block overflow-visible text-[10px]"
				role="group"
				aria-label="Contribution of each module to each impact category"
			>
				{#each [0, 0.5, 1] as t (t)}
					{@const gx = LABEL_W + t * plotW}
					<line x1={gx} x2={gx} y1="0" y2={rows.length * ROW_H} stroke="#e1e0d9" stroke-width="1" />
					<text
						x={gx}
						y={rows.length * ROW_H + 11}
						fill="#898781"
						text-anchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}>{t * 100}%</text
					>
				{/each}

				{#each bars as bar (bar.row.code)}
					<text x="0" y={bar.y + BAR_H / 2} dy="0.35em" fill="#52514e" font-weight="500"
						>{bar.row.code}</text
					>
					{#each bar.segs as seg, i (seg.key)}
						{@const color = keys[seg.key].color}
						{@const isEnd = i === bar.segs.length - 1}
						<!-- Focusable so keyboard users get the same tooltip as hover. -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<g
							role="img"
							tabindex="0"
							aria-label="{keys[seg.key].label}: {pctFmt.format(seg.share)}% of {bar.row.code}"
							class="cursor-default outline-none focus-visible:opacity-80"
							onpointerenter={(e) => show(e, e.currentTarget, seg, bar.row)}
							onpointermove={(e) => show(e, e.currentTarget, seg, bar.row)}
							onpointerleave={() => (tip = null)}
							onfocus={(e) => show(null, e.currentTarget, seg, bar.row)}
							onblur={() => (tip = null)}
						>
							<!-- Hit area: the whole row band, wider than the mark. -->
							<rect
								x={seg.x}
								y={bar.y - (ROW_H - BAR_H) / 2}
								width={Math.max(seg.w, 1)}
								height={ROW_H}
								fill="transparent"
							/>
							{#if isEnd}
								<path d={endPath(seg.x, bar.y, seg.w, BAR_H)} fill={color} />
							{:else}
								<rect x={seg.x} y={bar.y} width={seg.w} height={BAR_H} fill={color} />
							{/if}
							{#if seg === bar.largest}
								{@const label = `${pctFmt.format(seg.share)}%`}
								{#if seg.w >= label.length * 5.6 + 8}
									<text
										x={seg.x + seg.w / 2}
										y={bar.y + BAR_H / 2}
										dy="0.35em"
										text-anchor="middle"
										fill={inkOn(color)}
										font-weight="600"
										pointer-events="none">{label}</text
									>
								{/if}
							{/if}
						</g>
					{/each}
				{/each}
			</svg>
		{/if}
	</div>

	{#if tip}
		<div
			class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-white px-2 py-1.5 text-[11px] whitespace-nowrap shadow-md ring-1 ring-slate-900/10"
			style="left: {tip.x}px; top: {tip.y - 8}px"
		>
			<div class="flex items-center gap-1.5 font-medium text-slate-900">
				<span class="h-2 w-2 rounded-[2px]" style="background: {keys[tip.key].color}"></span>
				{keys[tip.key].label}
			</div>
			<div class="mt-0.5 text-slate-600 tabular-nums">
				{tip.code}: {pctFmt.format(tip.share)}% · {valFmt.format(tip.value)}
				{tip.unit}
			</div>
		</div>
	{/if}
</div>
