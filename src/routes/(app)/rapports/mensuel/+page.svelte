<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Download from '@lucide/svelte/icons/download';
	import Eye from '@lucide/svelte/icons/eye';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Alert from '#lib/components/ui/Alert.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const prep = $derived(data.prep);
	const hasMissing = $derived(prep.missingReports.length > 0);

	let introText = $state('');
	let conclusionText = $state('');
	let allowMissing = $state(false);
	let isGenerating = $state(false);

	$effect(() => {
		introText = prep.latestMonthlyReport?.introText || prep.defaultIntro;
		conclusionText = prep.latestMonthlyReport?.conclusionText || prep.defaultConclusion;
		allowMissing = false;
	});

	function resetTemplates() {
		introText = prep.defaultIntro;
		conclusionText = prep.defaultConclusion;
	}
</script>

<svelte:head>
	<title>{prep.monthLabel} · Rapport mensuel · Z_Pilot</title>
</svelte:head>

<div class="space-y-8">
	<!-- Page Header & Month Selector -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="eyebrow">Rapports d'activité</p>
			<h1 class="mt-1 text-2xl font-semibold sm:text-3xl">
				Rapport mensuel · {prep.monthLabel}
			</h1>
		</div>

		<!-- Navigation entre mois -->
		<div class="flex items-center gap-2">
			<a
				href="{resolve('/(app)/rapports/mensuel')}?mois={data.prevMonthParam}"
				class="btn btn-secondary px-3 py-2 text-xs"
				title="Mois précédent"
			>
				<ChevronLeft class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">Mois précédent</span>
			</a>

			{#if !data.isCurrentMonth}
				<a
					href={resolve('/(app)/rapports/mensuel')}
					class="btn btn-secondary px-3 py-2 text-xs font-semibold text-accent-ink"
				>
					Mois en cours
				</a>
			{/if}

			<a
				href="{resolve('/(app)/rapports/mensuel')}?mois={data.nextMonthParam}"
				class="btn btn-secondary px-3 py-2 text-xs"
				title="Mois suivant"
			>
				<span class="hidden sm:inline">Mois suivant</span>
				<ChevronRight class="size-4" aria-hidden="true" />
			</a>
		</div>
	</div>

	{#if form?.error}
		<Alert tone="danger">{form.error}</Alert>
	{/if}

	<!-- Latest Generated Report Banner if existing -->
	{#if prep.latestMonthlyReport}
		<div class="card border-accent/20 bg-accent-soft/30 p-5 sm:p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<CheckCircle2 class="size-5 text-accent" aria-hidden="true" />
						<span class="font-semibold text-ink">
							Un rapport mensuel a déjà été généré pour ce mois (Version {prep.latestMonthlyReport
								.version})
						</span>
					</div>
					<p class="text-xs text-ink-muted">
						Instantané créé le {new Date(prep.latestMonthlyReport.generatedAt).toLocaleDateString(
							'fr-FR',
							{
								day: 'numeric',
								month: 'long',
								year: 'numeric',
								hour: '2-digit',
								minute: '2-digit'
							}
						)}. Vous pouvez le consulter, l'exporter en Word ou générer une nouvelle version
						consolidée.
					</p>
				</div>
				<div class="flex items-center gap-2">
					<a
						href={resolve('/(app)/rapports/mensuel/[id]', { id: prep.latestMonthlyReport.id })}
						class="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
					>
						<Eye class="size-3.5" aria-hidden="true" />
						<span>Consulter</span>
					</a>
					<a
						href={resolve('/api/export/mensuel/[id]', { id: prep.latestMonthlyReport.id })}
						download
						class="btn btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
					>
						<Download class="size-3.5" aria-hidden="true" />
						<span>Word (.docx)</span>
					</a>
				</div>
			</div>
		</div>
	{/if}

	<!-- Consolidation Overview Card -->
	<section class="card p-6 sm:p-8" aria-labelledby="consolidation-title">
		<div class="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
			<div>
				<h2 id="consolidation-title" class="text-lg font-semibold sm:text-xl">
					Périmètre de consolidation du mois
				</h2>
				<p class="text-xs text-ink-muted">
					Règle RG-10 & CDC §5.2 : une semaine est rattachée au mois qui contient son mercredi.
				</p>
			</div>
			<div class="text-right">
				<span class="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted">
					{prep.weeks.length} semaine{prep.weeks.length > 1 ? 's' : ''} rattachée{prep.weeks
						.length > 1
						? 's'
						: ''}
				</span>
			</div>
		</div>

		<!-- Weeks Included Chips -->
		<div class="mt-4 flex flex-wrap gap-2">
			{#each prep.weekColumns as col (col.weekStart)}
				<div class="rounded-lg border border-line bg-surface-muted/50 px-3 py-1.5 text-xs">
					<span class="font-bold text-ink">{col.label}</span>
					<span class="ml-1 text-ink-muted">({col.periodLabel})</span>
				</div>
			{/each}
		</div>

		<!-- Metrics Quick Glance -->
		<div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div class="rounded-xl border border-line bg-surface p-4">
				<span class="text-xs font-medium text-ink-muted">Taux moyen d'atteinte</span>
				<p class="mt-1 font-serif text-2xl font-bold text-accent-ink">
					{prep.teamAveragePct !== null ? `${prep.teamAveragePct} %` : '—'}
				</p>
			</div>
			<div class="rounded-xl border border-line bg-surface p-4">
				<span class="text-xs font-medium text-ink-muted">Objectifs réalisés</span>
				<p class="mt-1 text-2xl font-bold text-ink">
					{prep.totalTasksCompleted}
					<span class="text-sm font-normal text-ink-muted">/ {prep.totalTasksAssigned}</span>
				</p>
			</div>
			<div class="rounded-xl border border-line bg-surface p-4">
				<span class="text-xs font-medium text-ink-muted">Membres pris en compte</span>
				<p class="mt-1 text-2xl font-bold text-ink">
					{prep.activeMembers.length}
				</p>
			</div>
			<div class="rounded-xl border border-line bg-surface p-4">
				<span class="text-xs font-medium text-ink-muted">Rapports hebdo publiés</span>
				<p class="mt-1 text-2xl font-bold {hasMissing ? 'text-warning' : 'text-success'}">
					{prep.publishedWeeklyReports.length}
					<span class="text-sm font-normal text-ink-muted"
						>/ {prep.activeMembers.length * prep.weeks.length}</span
					>
				</p>
			</div>
		</div>

		<!-- Missing Reports Warning (EF-MEN-02) -->
		{#if hasMissing}
			<div class="mt-6">
				<Alert tone="warning">
					<div class="space-y-3">
						<div class="flex items-center gap-2 font-semibold">
							<AlertTriangle class="size-5 shrink-0 text-warning" aria-hidden="true" />
							<span>Rapports hebdomadaires manquants ({prep.missingReports.length})</span>
						</div>
						<p class="text-xs leading-relaxed opacity-95">
							Certains collaborateurs n'ont pas encore de rapport hebdomadaire validé et publié pour
							toutes les semaines de ce mois. Conformément à la règle <span class="font-bold"
								>EF-MEN-02</span
							>, vous pouvez tout de même générer le rapport mensuel après confirmation explicite.
						</p>

						<div
							class="max-h-48 overflow-y-auto rounded-lg border border-warning/30 bg-surface/80 p-3"
						>
							<ul class="divide-y divide-line/40 text-xs">
								{#each prep.missingReports as missing (`${missing.member.id}-${missing.weekStart}`)}
									<li class="flex items-center justify-between py-1.5">
										<span class="font-medium text-ink">{missing.member.fullName}</span>
										<span
											class="rounded bg-warning-soft px-2 py-0.5 font-mono text-[11px] text-warning"
										>
											Semaine {missing.weekNumber} ({missing.periodLabel})
										</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				</Alert>
			</div>
		{:else}
			<div class="mt-6">
				<Alert tone="success">
					<div class="flex items-center gap-2 font-medium">
						<CheckCircle2 class="size-4 shrink-0" aria-hidden="true" />
						<span
							>Tous les rapports hebdomadaires du mois ({prep.publishedWeeklyReports.length}) sont
							validés et publiés. Les données sont complètes !</span
						>
					</div>
				</Alert>
			</div>
		{/if}
	</section>

	<!-- Generation Form with Text Templates (EF-MEN-04) -->
	<section class="card p-6 sm:p-8" aria-labelledby="generate-title">
		<div class="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
			<div>
				<h2 id="generate-title" class="text-lg font-semibold sm:text-xl">
					Rédaction et personnalisation du rapport
				</h2>
				<p class="text-xs text-ink-muted">
					Les textes ont été pré-rédigés automatiquement par gabarit de phrases (CDC §5.3). Vous
					pouvez les ajuster à votre convenance.
				</p>
			</div>

			<button
				type="button"
				class="btn btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
				onclick={resetTemplates}
				title="Rétablir les textes générés par défaut"
			>
				<RefreshCw class="size-3.5" aria-hidden="true" />
				<span>Rétablir les gabarits par défaut</span>
			</button>
		</div>

		<form
			method="POST"
			action="?/generate"
			use:enhance={() => {
				isGenerating = true;
				return async ({ update }) => {
					isGenerating = false;
					await update();
				};
			}}
			class="mt-6 space-y-6"
		>
			<input type="hidden" name="year" value={data.selectedYear} />
			<input type="hidden" name="month" value={data.selectedMonth} />

			<!-- Introduction Text -->
			<div>
				<label
					for="introText"
					class="label flex items-center justify-between text-xs font-semibold"
				>
					<span>1. Introduction & Synthèse d'ouverture</span>
					<span class="font-normal text-ink-muted">Modifiable</span>
				</label>
				<textarea
					id="introText"
					name="introText"
					rows="4"
					bind:value={introText}
					class="textarea mt-1.5 w-full text-sm leading-relaxed"
					placeholder="Saisissez l'introduction du rapport mensuel..."></textarea>
			</div>

			<!-- Conclusion Text -->
			<div>
				<label
					for="conclusionText"
					class="label flex items-center justify-between text-xs font-semibold"
				>
					<span>7. Conclusion & Perspectives managériales</span>
					<span class="font-normal text-ink-muted">Modifiable</span>
				</label>
				<textarea
					id="conclusionText"
					name="conclusionText"
					rows="4"
					bind:value={conclusionText}
					class="textarea mt-1.5 w-full text-sm leading-relaxed"
					placeholder="Saisissez la conclusion du rapport mensuel..."></textarea>
			</div>

			<!-- Confirmation if missing reports -->
			{#if hasMissing}
				<div class="rounded-xl border border-warning/40 bg-warning-soft/30 p-4">
					<label class="flex cursor-pointer items-start gap-3">
						<input
							type="checkbox"
							name="allowMissing"
							value="true"
							bind:checked={allowMissing}
							class="checkbox mt-0.5"
						/>
						<span class="text-xs leading-relaxed font-medium text-ink">
							Je confirme vouloir générer ce rapport mensuel malgré les <strong
								>{prep.missingReports.length} rapport(s) hebdomadaire(s) manquant(s)</strong
							> (EF-MEN-02).
						</span>
					</label>
				</div>
			{/if}

			<div class="flex items-center justify-end gap-3 pt-2">
				<button
					type="submit"
					class="btn btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
					disabled={isGenerating || (hasMissing && !allowMissing)}
				>
					<Sparkles class="size-4" aria-hidden="true" />
					<span>
						{isGenerating
							? 'Génération en cours…'
							: prep.latestMonthlyReport
								? `Générer une nouvelle version (v${prep.latestMonthlyReport.version + 1})`
								: 'Générer le rapport mensuel (v1)'}
					</span>
				</button>
			</div>
		</form>
	</section>

	<!-- Historical Monthly Reports Table -->
	{#if data.allReports.length > 0}
		<section class="card p-6 sm:p-8" aria-labelledby="history-title">
			<h2 id="history-title" class="border-b border-line pb-4 text-lg font-semibold sm:text-xl">
				Historique des rapports mensuels générés
			</h2>

			<div class="mt-4 overflow-x-auto">
				<table class="table w-full text-left text-sm">
					<thead>
						<tr class="border-b border-line text-xs text-ink-muted">
							<th class="pb-3 font-semibold">Mois</th>
							<th class="pb-3 font-semibold">Version</th>
							<th class="pb-3 font-semibold">Généré le</th>
							<th class="pb-3 font-semibold">Auteur</th>
							<th class="pb-3 text-right font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each data.allReports as rep (rep.id)}
							<tr class="hover:bg-surface-muted/30">
								<td class="py-3.5 font-semibold text-ink">
									{rep.snapshot?.monthLabel || `${rep.year}-${String(rep.month).padStart(2, '0')}`}
								</td>
								<td class="py-3.5 font-mono text-xs">
									<span class="rounded bg-surface-muted px-2 py-0.5 font-semibold text-accent-ink">
										v{rep.version}
									</span>
								</td>
								<td class="py-3.5 text-xs text-ink-muted">
									{new Date(rep.generatedAt).toLocaleDateString('fr-FR', {
										day: '2-digit',
										month: '2-digit',
										year: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</td>
								<td class="py-3.5 text-xs text-ink">
									{rep.publisherName}
								</td>
								<td class="py-3.5 text-right">
									<div class="inline-flex items-center gap-2">
										<a
											href={resolve('/(app)/rapports/mensuel/[id]', { id: rep.id })}
											class="btn btn-secondary px-2.5 py-1 text-xs"
											title="Consulter le rapport"
										>
											<Eye class="size-3.5" aria-hidden="true" />
											<span class="hidden sm:inline">Consulter</span>
										</a>
										<a
											href={resolve('/api/export/mensuel/[id]', { id: rep.id })}
											download
											class="btn btn-secondary px-2.5 py-1 text-xs text-accent-ink"
											title="Télécharger le document Word"
										>
											<Download class="size-3.5" aria-hidden="true" />
											<span class="hidden sm:inline">Word</span>
										</a>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>
