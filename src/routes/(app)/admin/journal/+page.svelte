<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Search from '@lucide/svelte/icons/search';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import { formatDateTime } from '#lib/format.js';

	let { data } = $props();

	const isFiltered = $derived(data.filters.q !== '' || data.filters.action !== 'all');

	function actionInfo(action: string): {
		label: string;
		tone: 'success' | 'warning' | 'danger' | 'neutral';
	} {
		switch (action) {
			case 'user.created':
				return { label: 'Création de compte', tone: 'success' };
			case 'user.updated':
				return { label: 'Modification de compte', tone: 'neutral' };
			case 'user.deactivated':
				return { label: 'Désactivation de compte', tone: 'danger' };
			case 'user.reactivated':
				return { label: 'Réactivation de compte', tone: 'success' };
			case 'user.password_reset':
				return { label: 'Réinitialisation mot de passe', tone: 'warning' };
			case 'user.password_changed':
				return { label: 'Changement mot de passe', tone: 'neutral' };
			case 'user.locked':
				return { label: 'Verrouillage sécurité', tone: 'danger' };
			case 'settings.updated':
				return { label: 'Paramètres modifiés', tone: 'neutral' };
			default:
				return { label: action, tone: 'neutral' };
		}
	}

	function badgeClass(tone: 'success' | 'warning' | 'danger' | 'neutral'): string {
		switch (tone) {
			case 'success':
				return 'bg-success-soft text-success';
			case 'warning':
				return 'bg-warning-soft text-warning';
			case 'danger':
				return 'bg-danger-soft text-danger';
			default:
				return 'bg-surface-muted text-ink';
		}
	}

	function formatDetail(key: string, value: unknown): string {
		if (value === null || value === undefined) return 'aucun';
		if (typeof value === 'boolean') return value ? 'oui' : 'non';
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}
</script>

<svelte:head><title>Journal d’audit · Z_Pilot</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<p class="eyebrow">Administration</p>
		<h1 class="mt-2 text-4xl font-semibold">Journal d’audit</h1>
		<p class="mt-2 text-ink-muted">
			Traçabilité des opérations sensibles (créations, réinitialisations, verrouillages,
			paramètres).
		</p>
	</div>
</div>

<!-- Filtres et Recherche -->
<form
	method="GET"
	class="card mt-6 grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
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
				placeholder="Acteur, identifiant ou action..."
				value={data.filters.q}
			/>
		</div>
	</div>

	<div>
		<label class="field-label" for="action">Type d’opération</label>
		<select id="action" name="action" class="input" value={data.filters.action}>
			<option value="all">Toutes les opérations</option>
			<option value="user.created">Création de compte</option>
			<option value="user.updated">Modification de compte</option>
			<option value="user.deactivated">Désactivation</option>
			<option value="user.reactivated">Réactivation</option>
			<option value="user.password_reset">Réinitialisation de mot de passe</option>
			<option value="user.password_changed">Changement de mot de passe</option>
			<option value="user.locked">Verrouillage sécurité (5 échecs)</option>
			<option value="settings.updated">Paramètres généraux</option>
		</select>
	</div>

	<button class="btn btn-secondary">Filtrer</button>
</form>

<div class="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
	<p aria-live="polite">
		{data.result.total} événement{data.result.total > 1 ? 's' : ''}
		{isFiltered ? ' correspondant aux filtres' : ''}
		{#if isFiltered}
			·
			<a
				class="font-medium text-ink underline underline-offset-4"
				href={resolve('/(app)/admin/journal')}>Tout réinitialiser</a
			>
		{/if}
	</p>

	{#if data.result.totalPages > 1}
		<p>
			Page {data.result.page} sur {data.result.totalPages}
		</p>
	{/if}
</div>

{#if data.result.entries.length === 0}
	<section class="card mt-3 p-8 text-center">
		<ShieldAlert class="mx-auto size-8 text-ink-muted" aria-hidden="true" />
		<p class="mt-2 font-medium">Aucun événement enregistré.</p>
		<p class="mt-1 text-sm text-ink-muted">Modifiez la recherche ou les filtres.</p>
	</section>
{:else}
	<div class="card mt-3 overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead
					class="border-b border-line bg-surface-muted/50 text-xs font-semibold text-ink-muted uppercase"
				>
					<tr>
						<th class="px-4 py-3 sm:px-6">Date & Heure</th>
						<th class="px-4 py-3 sm:px-6">Opération</th>
						<th class="px-4 py-3 sm:px-6">Auteur</th>
						<th class="px-4 py-3 sm:px-6">Détails</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each data.result.entries as entry (entry.id)}
						{@const info = actionInfo(entry.action)}
						<tr class="hover:bg-surface-muted/30">
							<td class="px-4 py-4 text-xs whitespace-nowrap text-ink-muted sm:px-6">
								{formatDateTime(entry.createdAt)}
							</td>
							<td class="px-4 py-4 whitespace-nowrap sm:px-6">
								<span
									class={[
										'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
										badgeClass(info.tone)
									]}
								>
									{info.label}
								</span>
							</td>
							<td class="px-4 py-4 whitespace-nowrap sm:px-6">
								{#if entry.actor}
									<p class="font-medium text-ink">{entry.actor.fullName}</p>
									<p class="font-mono text-xs text-ink-muted">{entry.actor.username}</p>
								{:else}
									<span class="rounded bg-surface-muted px-2 py-0.5 text-xs text-ink-muted"
										>Système</span
									>
								{/if}
							</td>
							<td class="max-w-md px-4 py-4 text-xs text-ink-muted sm:px-6">
								{#if entry.details}
									{#if entry.details.changes}
										<div class="space-y-1">
											{#each Object.entries(entry.details.changes as Record<string, { from: unknown; to: unknown }>) as [field, change] (field)}
												<p>
													<span class="font-medium text-ink">{field}</span> :
													<span class="line-through">{formatDetail(field, change.from)}</span>
													→
													<span class="font-medium text-ink">{formatDetail(field, change.to)}</span>
												</p>
											{/each}
										</div>
									{:else if entry.details.reason}
										<p>
											Motif : <span class="font-medium text-ink">{entry.details.reason}</span>
										</p>
									{:else if entry.details.failedAttempts}
										<p class="text-danger">
											{entry.details.failedAttempts} échecs consécutifs
										</p>
									{:else if entry.details.username}
										<p>
											Compte : <span class="font-medium text-ink">{entry.details.fullName}</span>
											({entry.details.username})
										</p>
									{:else}
										<pre
											class="max-w-xs overflow-x-auto text-[11px] text-ink-muted">{JSON.stringify(
												entry.details
											)}</pre>
									{/if}
								{:else}
									<span class="text-ink-muted">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	{#if data.result.totalPages > 1}
		<div class="mt-6 flex items-center justify-between">
			<div>
				{#if data.result.page > 1}
					<a
						class="btn btn-secondary text-xs"
						href="{resolve('/(app)/admin/journal')}?page={data.result.page -
							1}&q={encodeURIComponent(data.filters.q)}&action={data.filters.action}"
					>
						<ChevronLeft class="size-4" aria-hidden="true" /> Précédent
					</a>
				{/if}
			</div>

			<p class="text-xs text-ink-muted">
				Page {data.result.page} / {data.result.totalPages}
			</p>

			<div>
				{#if data.result.page < data.result.totalPages}
					<a
						class="btn btn-secondary text-xs"
						href="{resolve('/(app)/admin/journal')}?page={data.result.page +
							1}&q={encodeURIComponent(data.filters.q)}&action={data.filters.action}"
					>
						Suivant <ChevronRight class="size-4" aria-hidden="true" />
					</a>
				{/if}
			</div>
		</div>
	{/if}
{/if}
