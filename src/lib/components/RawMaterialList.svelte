<script lang="ts">
	import type { ApiFeedstock, ApiSuperstructure } from '$lib/types';

	let {
		feedstocks,
		declared,
		excluded,
		augment,
		result,
		onfeedstock,
		onauxiliary,
		onaugment,
		onhover
	}: {
		feedstocks: ApiFeedstock[];
		declared: Set<string>;
		excluded: Set<string>;
		augment: boolean;
		result: ApiSuperstructure | null;
		/** Checked: declared in R_init. Unchecked: excluded with its consuming modules. */
		onfeedstock: (slug: string, included: boolean) => void;
		/** Checked: declared in R_init. Unchecked: left to augmentation. */
		onauxiliary: (slug: string, declared: boolean) => void;
		onaugment: (on: boolean) => void;
		onhover: (slug: string | null) => void;
	} = $props();

	const primary = $derived(feedstocks.filter((f) => f.kind === 'feedstock'));
	const auxiliary = $derived(feedstocks.filter((f) => f.kind === 'auxiliary'));
	const promoted = $derived(new Set(result?.raw_materials.augmented ?? []));
	const extra = $derived(
		(result?.raw_materials.augmented ?? []).filter((s) => !feedstocks.some((f) => f.slug === s))
	);

	function status(slug: string): { text: string; tone: string } {
		if (excluded.has(slug)) return { text: 'excluded', tone: 'text-slate-400' };
		if (result?.raw_materials.declared.includes(slug))
			return { text: 'declared', tone: 'text-slate-500' };
		if (promoted.has(slug)) return { text: 'augmented', tone: 'text-amber-700' };
		return { text: 'not in R', tone: 'text-red-600' };
	}

	const head = (name: string) => name.split(', ')[0];
</script>

<section class="px-4 pt-4 pb-3">
	<h2 class="mb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
		Raw materials
	</h2>

	<label
		class="mb-3 flex cursor-pointer items-start gap-2.5 rounded-md bg-slate-50 px-2.5 py-2 ring-1 ring-slate-900/5"
	>
		<input
			type="checkbox"
			class="mt-0.5 h-3.5 w-3.5 accent-slate-900"
			checked={augment}
			onchange={(e) => onaugment(e.currentTarget.checked)}
		/>
		<span class="text-xs leading-snug text-slate-700">
			<span class="font-medium text-slate-900">Augment R (Algorithm 1)</span><br />
			<span class="text-[11px] text-slate-500">Every input no operating unit produces joins R.</span
			>
		</span>
	</label>

	{#if primary.length}
		<h3 class="mb-1 text-[11px] font-medium text-slate-500">Feedstocks · R<sub>init</sub></h3>
		<ul class="mb-3 space-y-0.5">
			{#each primary as f (f.slug)}
				{@const st = status(f.slug)}
				<li>
					<label
						class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-800 hover:bg-slate-50"
						onmouseenter={() => onhover(f.slug)}
						onmouseleave={() => onhover(null)}
					>
						<input
							type="checkbox"
							class="h-3.5 w-3.5 accent-slate-900"
							checked={!excluded.has(f.slug)}
							onchange={(e) => onfeedstock(f.slug, e.currentTarget.checked)}
						/>
						<span
							class="min-w-0 flex-1 truncate"
							class:line-through={excluded.has(f.slug)}
							title={f.name}>{head(f.name)}</span
						>
						<span class="text-[10px] {st.tone}">{st.text}</span>
					</label>
				</li>
			{/each}
		</ul>
	{/if}

	{#if auxiliary.length}
		<h3 class="mb-1 text-[11px] font-medium text-slate-500">Auxiliary inputs</h3>
		<ul class="space-y-0.5">
			{#each auxiliary as f (f.slug)}
				{@const st = status(f.slug)}
				<li>
					<label
						class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-800 hover:bg-slate-50"
						title="Tick to declare it in R_init instead of leaving it to augmentation"
						onmouseenter={() => onhover(f.slug)}
						onmouseleave={() => onhover(null)}
					>
						<input
							type="checkbox"
							class="h-3.5 w-3.5 accent-slate-900"
							checked={declared.has(f.slug)}
							onchange={(e) => onauxiliary(f.slug, e.currentTarget.checked)}
						/>
						<span class="min-w-0 flex-1 truncate" title={f.name}>{head(f.name)}</span>
						<span class="text-[10px] {st.tone}">{st.text}</span>
					</label>
				</li>
			{/each}
		</ul>
	{/if}

	{#if extra.length}
		<p class="mt-2 text-[11px] leading-snug text-amber-700">
			Also promoted to R: {extra.join(', ')}
		</p>
	{/if}
</section>
