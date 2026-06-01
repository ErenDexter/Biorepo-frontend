<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ApiProduct } from '$lib/types';

	let products = $state<ApiProduct[]>([]);
	let selected = $state<string>('');
	let loading = $state(true);
	let err = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/products');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			products = await res.json();
			selected = products[0]?.id ?? '';
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});

	function go() {
		if (!selected) return;
		goto(`/superstructure?productId=${encodeURIComponent(selected)}`);
	}
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-8">
	<header>
		<h1 class="text-3xl font-semibold text-slate-900">Biorefinery superstructure</h1>
		<p class="mt-2 text-slate-600">
			Pick an end product to generate its pathway superstructure from the available
			feedstocks and unit operations.
		</p>
	</header>

	{#if loading}
		<p class="text-slate-500">Loading products…</p>
	{:else if err}
		<p class="text-red-700">Failed to load products: {err}</p>
	{:else if products.length === 0}
		<p class="text-slate-500">No products in the database yet.</p>
	{:else}
		<form
			class="flex items-end gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				go();
			}}
		>
			<label class="flex-1">
				<span class="mb-1 block text-sm font-medium text-slate-700">End product</span>
				<select
					bind:value={selected}
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
				>
					{#each products as p (p.id)}
						<option value={p.id}>{p.name}</option>
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
	{/if}
</main>
