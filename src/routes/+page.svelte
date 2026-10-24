<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, API_BASE } from '$lib/api';
	import type { ApiLibrary, ApiProduct } from '$lib/types';

	let products = $state<ApiProduct[]>([]);
	let library = $state<ApiLibrary | null>(null);
	let selected = $state<string>('');
	let loading = $state(true);
	let err = $state<string | null>(null);

	onMount(async () => {
		try {
			[products, library] = await Promise.all([api.products(), api.library()]);
			selected = products[0]?.slug ?? '';
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	function go() {
		if (!selected) return;
		goto(`/superstructure?product=${encodeURIComponent(selected)}`);
	}
</script>

<svelte:head><title>Biorefinery superstructure</title></svelte:head>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-8">
	<header>
		<p class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
			Biorefinery process repository
		</p>
		<h1 class="mt-1 text-3xl font-semibold text-slate-900">Superstructure generation</h1>
		<p class="mt-2 text-sm leading-relaxed text-slate-600">
			Pick a target product. The backend augments the raw material set, generates the maximal
			structure (MSG), enumerates every solution structure (SSG), reduces them to irreducible
			pathways and assesses each with the modular LCA.
		</p>
	</header>

	{#if loading}
		<p class="text-sm text-slate-500">Connecting to the backend…</p>
	{:else if err}
		<div class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
			<p>{err}</p>
			<p class="mt-1 text-xs text-red-700">
				Start it from <code>backend/</code> with
				<code>.venv\Scripts\python -m uvicorn biorepo_api:app</code>.
			</p>
		</div>
	{:else if products.length === 0}
		<p class="text-sm text-slate-500">The library has no products.</p>
	{:else}
		<form
			class="flex items-end gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				go();
			}}
		>
			<label class="flex-1">
				<span class="mb-1 block text-sm font-medium text-slate-700">Target product</span>
				<select
					bind:value={selected}
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
				>
					{#each products as p (p.slug)}
						<option value={p.slug}>{p.name}{p.terminal ? '' : ' (intermediate)'}</option>
					{/each}
				</select>
			</label>
			<button
				type="submit"
				class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
				disabled={!selected}
			>
				Build superstructure
			</button>
		</form>

		{#if library}
			<p class="text-xs text-slate-500">
				{library.name} v{library.version} · {library.counts.modules} modules · {library.counts
					.materials} materials ·
				{library.counts.collections} collections · served by <code>{API_BASE}</code>
			</p>
		{/if}
	{/if}
</main>
