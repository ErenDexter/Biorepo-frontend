<script lang="ts">
	import { api, ApiError, type SuperstructureQuery } from '$lib/api';
	import type { ApiAssessment, ApiPathway, ApiStructure } from '$lib/types';

	let {
		pathway,
		structure,
		query,
		names,
		productName
	}: {
		pathway: ApiPathway | null;
		structure: ApiStructure | null;
		/** The synthesis the pathway came from; the backend re-runs it to assess. */
		query: SuperstructureQuery;
		/** Node id -> display name. */
		names: Map<string, string>;
		productName: string;
	} = $props();

	let demand = $state(1);
	let result = $state.raw<ApiAssessment | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let worked = $state(0);

	// Every number below is computed by the backend; this view only lays it out.
	let seq = 0;
	$effect(() => {
		const modules = pathway?.assessable ? pathway.modules : null;
		const q = query;
		const fu = demand > 0 ? demand : 1;
		const ticket = ++seq;
		result = null;
		error = null;
		if (!modules) return;
		loading = true;
		const timer = setTimeout(() => {
			api
				.evaluate(q, modules, fu)
				.then((r) => {
					if (ticket === seq) result = r;
				})
				.catch((e) => {
					if (ticket === seq)
						error = e instanceof ApiError || e instanceof Error ? e.message : String(e);
				})
				.finally(() => {
					if (ticket === seq) loading = false;
				});
		}, 150);
		return () => clearTimeout(timer);
	});

	const head = (id: string) => (names.get(id) ?? id).split(', ')[0];
	const MINUS = '−';
	const sig5 = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 });
	const sig3 = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 });
	const pct = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	/** Plain digits in a readable range, otherwise mantissa x 10^exponent. */
	function num(v: number): { m: string; e: string | null } {
		if (v === 0) return { m: '0', e: null };
		const a = Math.abs(v);
		if (a >= 1e-3 && a < 1e5) return { m: sig5.format(v).replace('-', MINUS), e: null };
		const e = Math.floor(Math.log10(a));
		return { m: sig3.format(v / 10 ** e).replace('-', MINUS), e: String(e).replace('-', MINUS) };
	}

	const n = $derived(result?.basis.length ?? 0);
	const idx = $derived(Array.from({ length: n }, (_, j) => String(j + 1)));
	const codes = $derived(result?.h.map((c) => c.code) ?? []);
	const muPrime = $derived(
		result ? result.basis.map((_, j) => (j === 0 ? null : -result!.A[j - 1][j])) : []
	);
	const fu = $derived(result ? result.demand : 1);
</script>

{#snippet value(v: number)}
	{@const x = num(v)}
	<span class:text-slate-300={v === 0}
		>{x.m}{#if x.e !== null}<span class="text-slate-500">×10<sup>{x.e}</sup></span>{/if}</span
	>
{/snippet}

{#snippet matrix(values: number[][], rowHead: string[], colHead: string[])}
	{@const rows = values.length}
	{@const cols = values[0]?.length ?? 0}
	<div class="overflow-x-auto pb-1">
		<div
			class="inline-grid items-center text-[11px] tabular-nums"
			style="grid-template-columns: auto 5px repeat({cols}, auto) 5px;"
		>
			{#each colHead as c, j (j)}
				<span
					class="px-2 pb-0.5 text-right text-[10px] text-slate-400"
					style="grid-column: {j + 3}; grid-row: 1">{c}</span
				>
			{/each}
			<span
				class="self-stretch border-y border-l border-slate-500"
				style="grid-column: 2; grid-row: 2 / span {rows}"
			></span>
			<span
				class="self-stretch border-y border-r border-slate-500"
				style="grid-column: {cols + 3}; grid-row: 2 / span {rows}"
			></span>
			{#each values as row, i (i)}
				<span
					class="pr-1.5 text-right text-[10px] text-slate-400"
					style="grid-column: 1; grid-row: {i + 2}">{rowHead[i]}</span
				>
				{#each row as v, j (j)}
					<span
						class="px-2 py-[3px] text-right text-slate-800"
						style="grid-column: {j + 3}; grid-row: {i + 2}">{@render value(v)}</span
					>
				{/each}
			{/each}
		</div>
	</div>
{/snippet}

{#snippet step(no: number, title: string, eq: string)}
	<h3 class="mt-5 mb-1.5 flex items-baseline gap-2 text-xs font-semibold text-slate-900">
		<span
			class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] text-white"
			>{no}</span
		>
		<span class="flex-1">{title}</span>
		{#if eq}<span class="text-[10px] font-normal text-slate-400">{eq}</span>{/if}
	</h3>
{/snippet}

<div class="px-4 py-4 text-xs text-slate-700">
	{#if !pathway}
		<p class="leading-relaxed text-slate-500">
			{#if structure && !structure.pathway_id}
				{structure.id} is a composite: the union of simpler solution structures, not a distinct route.
				Composites are not assessed; select a pathway instead.
			{:else}
				Select a pathway on the left to see its life cycle assessment worked through, from the
				module data to the impact vector.
			{/if}
		</p>
	{:else if !pathway.assessable}
		<p class="leading-relaxed text-amber-700">{pathway.error?.detail}</p>
	{:else}
		<div class="flex items-center gap-1.5">
			<span
				class="rounded-sm bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase"
				>{pathway.id}</span
			>
			<span class="text-sm font-semibold text-slate-900"
				>{pathway.feedstock ? head(pathway.feedstock) : ''} route</span
			>
			{#if loading}<span class="ml-auto text-[11px] text-slate-400">computing…</span>{/if}
		</div>
		<label class="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
			Functional unit
			<input
				type="number"
				min="0"
				step="any"
				bind:value={demand}
				class="w-20 rounded-md border border-slate-200 px-1.5 py-0.5 text-right text-xs tabular-nums focus:border-slate-400 focus:outline-none"
			/>
			<span>kg {productName.split(', ')[0]}</span>
		</label>

		{#if error}
			<p class="mt-3 text-amber-700">{error}</p>
		{:else if result}
			{@const r = result}
			{@render step(1, 'Modules along the chain', 'Fig. 2–3')}
			<p class="mb-2 leading-relaxed text-slate-500">
				Each module is referred to 1 kg of its own output. μ′<sub>j</sub> is the specific material consumption:
				kg of material j−1 per kg of material j. The first module's raw material is carried inside its
				h̃, so μ′ is undefined there.
			</p>
			<table class="w-full text-[11px] tabular-nums">
				<thead class="text-[10px] text-slate-400">
					<tr>
						<th class="py-0.5 pr-1 text-left font-normal">j</th>
						<th class="py-0.5 pr-1 text-left font-normal">Module</th>
						<th class="py-0.5 pr-1 text-left font-normal">Output (1 kg)</th>
						<th class="py-0.5 text-right font-normal">μ′<sub>j</sub></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each r.basis as b, j (b.module)}
						<tr>
							<td class="py-1 pr-1 text-slate-400">{j + 1}</td>
							<td class="py-1 pr-1 text-slate-800" title={names.get(b.module)}>{head(b.module)}</td>
							<td class="py-1 pr-1 text-slate-600" title={names.get(b.material)}
								>{head(b.material)}</td
							>
							<td class="py-1 text-right text-slate-800"
								>{#if muPrime[j] === null}<span class="text-slate-300">—</span
									>{:else}{@render value(muPrime[j]!)}{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>

			{@render step(2, 'Technology matrix A', 'Eq. (8)')}
			<p class="mb-2 leading-relaxed text-slate-500">
				a<sub>jj</sub> = 1 and a<sub>j−1,j</sub> = −μ′<sub>j</sub>: column j is module j, row j the
				material it outputs.
			</p>
			{@render matrix(r.A, idx, idx)}

			{@render step(3, 'Final demand f', '')}
			<p class="mb-2 leading-relaxed text-slate-500">
				One unit of the last material, the product, delivered by module {n}.
			</p>
			{@render matrix([r.f], ['fᵀ'], idx)}

			{@render step(4, 'Scaling vector s = A⁻¹ f', 'Eq. (6)')}
			<p class="mb-2 leading-relaxed text-slate-500">
				s<sub>j</sub> is the output of module j needed per kg of product. det A = {sig5.format(
					r.diagnostics.determinant
				)}, cond A = {sig3.format(r.diagnostics.condition_number)}.
			</p>
			{@render matrix([r.s], ['sᵀ'], idx)}

			{@render step(5, 'Specific impact matrix H̃', 'Eq. (9)')}
			<p class="mb-2 leading-relaxed text-slate-500">
				h̃<sub>kj</sub>: impact in category k per kg of module j's output, from the stored module
				data.
			</p>
			{@render matrix(r.H.values, codes, idx)}

			{@render step(
				6,
				fu === 1 ? 'Impact vector h = H̃ s' : 'Impact vector h = FU · H̃ s',
				fu === 1 ? 'Eq. (11)' : 'Eq. (11), (12)'
			)}
			<div class="mb-2 flex flex-wrap gap-1">
				{#each codes as c, k (c)}
					<button
						type="button"
						class="rounded px-1.5 py-0.5 text-[10px] font-medium {worked === k
							? 'bg-slate-900 text-white'
							: 'bg-slate-100 text-slate-600 hover:text-slate-900'}"
						onclick={() => (worked = k)}>{c}</button
					>
				{/each}
			</div>
			{#if r.h[worked]}
				{@const k = worked}
				<p
					class="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed tabular-nums ring-1 ring-slate-900/5"
				>
					h<sub>{codes[k]}</sub> = {#if fu !== 1}{sig5.format(fu)} × ({/if}{#each r.s as sj, j (j)}{#if j > 0}{' + '}{/if}{@render value(
							r.H.values[k][j]
						)} × {@render value(sj)}{/each}{#if fu !== 1}){/if}
					= <b class="text-slate-900">{@render value(r.h[k].value)}</b>
					{r.h[k].unit}
				</p>
			{/if}
			<table class="mt-2 w-full text-[11px] tabular-nums">
				<tbody class="divide-y divide-slate-100">
					{#each r.h as c (c.code)}
						<tr>
							<td class="py-1 pr-2 font-medium text-slate-800" title={c.name}>{c.code}</td>
							<td class="py-1 pr-2 text-right text-slate-900">{@render value(c.value)}</td>
							<td class="py-1 text-slate-500">{c.unit}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{@render step(7, 'Contributions h̃ₖⱼ sⱼ', 'share of h, %')}
			<table class="w-full text-[11px] tabular-nums">
				<thead class="text-[10px] text-slate-400">
					<tr>
						<th class="py-0.5 pr-1 text-left font-normal">j</th>
						{#each codes as c (c)}<th class="py-0.5 text-right font-normal">{c}</th>{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each r.basis as b, j (b.module)}
						<tr>
							<td class="py-1 pr-1 text-slate-600" title={names.get(b.module)}
								>{j + 1} · {head(b.module)}</td
							>
							{#each r.h as c (c.code)}
								{@const share = c.value
									? (r.contributions[c.category][b.module] / c.value) * 100
									: 0}
								<td class="py-1 pl-1 text-right">
									<span class="relative inline-block min-w-11">
										<span
											class="absolute inset-y-0 right-0 rounded-sm bg-slate-200"
											style="width: {Math.max(0, Math.min(100, share))}%"
										></span>
										<span class="relative pr-0.5 text-slate-800">{pct.format(share)}</span>
									</span>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>

			<p class="mt-5 text-[10px] leading-relaxed text-slate-400">
				Method {r.method} · {(r.provenance.background_db as string[] | undefined)?.join(', ') ?? ''}
				{(r.provenance.system_model as string[] | undefined)?.join(', ') ?? ''} · from synthesis of
				{r.synthesis.solution_structures} solution structures, {r.synthesis.pathways} pathways.
			</p>
			{#each r.warnings as w (w)}
				<p class="mt-2 text-[11px] leading-snug text-amber-700">{w}</p>
			{/each}
		{/if}
	{/if}
</div>
