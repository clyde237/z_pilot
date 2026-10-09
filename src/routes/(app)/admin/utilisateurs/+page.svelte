<script lang="ts">
	import { resolve } from '$app/paths';
	import Lock from '@lucide/svelte/icons/lock';
	import Search from '@lucide/svelte/icons/search';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { roleLabels } from '#lib/domain/roles.js';
	import { formatTime } from '#lib/format.js';

	let { data } = $props();

	const now = new Date();
	const filtered = $derived(
		data.filters.q !== '' || data.filters.status !== 'all' || data.filters.role !== 'all'
	);
</script>

<svelte:head><title>Utilisateurs · Z_Pilot</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<p class="eyebrow">Administration</p>
		<h1 class="mt-2 text-4xl font-semibold">Utilisateurs</h1>
	</div>
	<a href={resolve('/(app)/admin/utilisateurs/nouveau')} class="btn btn-primary">
		<UserPlus class="size-4" aria-hidden="true" /> Nouvel utilisateur
	</a>
</div>

<form
	method="GET"
	class="card mt-6 grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
	role="search"
>
	<div>
		<label class="field-label" for="q">Rechercher</label>
		<div class="relative">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
				aria-hidden="true"
			/>
			<input
				id="q"
				name="q"
				type="search"
				class="input pl-9"
				placeholder="Nom ou identifiant"
				value={data.filters.q}
			/>
		</div>
	</div>
	<div>
		<label class="field-label" for="status">Statut</label>
		<select id="status" name="status" class="input" value={data.filters.status}>
			<option value="all">Tous</option>
			<option value="active">Actifs</option>
			<option value="inactive">Désactivés</option>
		</select>
	</div>
	<div>
		<label class="field-label" for="role">Rôle</label>
		<select id="role" name="role" class="input" value={data.filters.role}>
			<option value="all">Tous</option>
			<option value="admin">Administrateurs</option>
			<option value="chef">Chef de département</option>
			<option value="member">Membres</option>
		</select>
	</div>
	<button class="btn btn-secondary">Filtrer</button>
</form>

<p class="mt-6 text-sm text-ink-muted" aria-live="polite">
	{data.accounts.length} compte{data.accounts.length > 1 ? 's' : ''}{filtered
		? ' correspondant aux filtres'
		: ''}
	{#if filtered}· <a
			class="font-medium text-ink underline underline-offset-4"
			href={resolve('/(app)/admin/utilisateurs')}>Tout afficher</a
		>{/if}
</p>

{#if data.accounts.length === 0}
	<section class="card mt-3 p-8 text-center">
		<p class="font-medium">Aucun compte ne correspond.</p>
		<p class="mt-1 text-sm text-ink-muted">Modifiez la recherche ou les filtres.</p>
	</section>
{:else}
	<ul class="card mt-3 divide-y divide-line">
		{#each data.accounts as account (account.id)}
			{@const locked = account.lockedUntil !== null && account.lockedUntil > now}
			<li>
				<a
					href={resolve('/(app)/admin/utilisateurs/[id]', { id: account.id })}
					class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 hover:bg-surface-muted sm:px-6"
				>
					<div class="min-w-0 flex-1 basis-52">
						<p class={['font-semibold', !account.active && 'text-ink-muted']}>{account.fullName}</p>
						<p class="font-mono text-sm text-ink-muted">{account.username}</p>
					</div>
					<div class="flex flex-wrap items-center gap-2 text-xs font-medium">
						{#each roleLabels(account) as label (label)}
							<span class="rounded-full bg-surface-muted px-2.5 py-1">{label}</span>
						{/each}
						{#if account.mustChangePassword && account.active}
							<span class="rounded-full bg-accent-soft px-2.5 py-1 text-accent-ink"
								>Mot de passe à définir</span
							>
						{/if}
						{#if locked}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-warning"
							>
								<Lock class="size-3" aria-hidden="true" /> Bloqué jusqu’à {formatTime(
									account.lockedUntil!
								)}
							</span>
						{/if}
						<span
							class={[
								'rounded-full px-2.5 py-1',
								account.active ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
							]}>{account.active ? 'Actif' : 'Désactivé'}</span
						>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
