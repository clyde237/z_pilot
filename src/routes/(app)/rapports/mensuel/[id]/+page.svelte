<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Download from '@lucide/svelte/icons/download';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	const snapshot = $derived(data.snapshot);
	const monthParam = $derived(`${snapshot.year}-${String(snapshot.month).padStart(2, '0')}`);

	function formatDate(d: Date | string): string {
		return new Date(d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDateTime(d: Date | string): string {
		return new Date(d).toLocaleDateString('fr-FR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>{snapshot.monthLabel} · Rapport mensuel · Z_Pilot</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6">
	<!-- Top Bar -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<a
			href="{resolve('/(app)/rapports/mensuel')}?mois={monthParam}"
			class="btn btn-secondary inline-flex items-center gap-2 text-sm"
		>
			<ArrowLeft class="size-4" aria-hidden="true" />
			Retour aux rapports mensuels
		</a>

		<a
			href={resolve('/api/export/mensuel/[id]', { id: data.report.id })}
			download
			class="btn btn-primary inline-flex items-center gap-2 text-sm"
		>
			<Download class="size-4" aria-hidden="true" />
			Télécharger en Word (.docx)
		</a>
	</div>

	<!-- Main Report Card -->
	<article class="card divide-y divide-line p-6 sm:p-10">
		<!-- Header -->
		<div class="pb-8">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success"
					>
						<CheckCircle2 class="size-3.5" aria-hidden="true" />
						Rapport mensuel validé (version {data.report.version})
					</span>
					<h1 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
						Rapport d'activité mensuel
					</h1>
					<p class="mt-1 font-serif text-xl font-semibold text-accent-ink">
						{snapshot.monthLabel}
					</p>
				</div>

				<div class="text-right text-xs text-ink-muted">
					<p class="font-semibold text-ink">{snapshot.organizationName}</p>
					<p>{snapshot.departmentName}</p>
					<p class="mt-1">Généré le {formatDate(data.report.generatedAt)}</p>
					<p class="mt-0.5">Par {data.report.publisherName}</p>
				</div>
			</div>
		</div>

		<!-- 1. Introduction -->
		<section class="py-8" aria-labelledby="section-intro">
			<h2 id="section-intro" class="text-xl font-bold text-ink">1. Introduction & Contexte</h2>
			<div
				class="mt-4 rounded-xl border border-line bg-surface-muted/30 p-5 text-sm leading-relaxed text-ink"
			>
				{snapshot.introText}
			</div>
		</section>

		<!-- 2. Indicateurs clés -->
		<section class="py-8" aria-labelledby="section-kpi">
			<h2 id="section-kpi" class="text-xl font-bold text-ink">
				2. Indicateurs clés de performance
			</h2>

			<!-- KPI Cards -->
			<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div class="rounded-xl border border-line bg-surface p-5 text-center">
					<span class="text-xs font-medium text-ink-muted">Taux moyen d'atteinte</span>
					<p class="mt-2 font-serif text-4xl font-bold text-accent-ink">
						{snapshot.keyIndicators.teamAverageProgressPct !== null
							? `${snapshot.keyIndicators.teamAverageProgressPct} %`
							: '—'}
					</p>
					<span class="mt-1 block text-xs text-ink-muted">Progression globale de l'équipe</span>
				</div>

				<div class="rounded-xl border border-line bg-surface p-5 text-center">
					<span class="text-xs font-medium text-ink-muted">Objectifs réalisés</span>
					<p class="mt-2 text-3xl font-bold text-ink">
						{snapshot.keyIndicators.totalTasksCompleted}
						<span class="text-lg font-normal text-ink-muted"
							>/ {snapshot.keyIndicators.totalTasksAssigned}</span
						>
					</p>
					<span class="mt-1 block text-xs text-ink-muted">Tâches hebdomadaires traitées</span>
				</div>

				<div class="rounded-xl border border-line bg-surface p-5 text-center">
					<span class="text-xs font-medium text-ink-muted">Évolution mensuelle</span>
					<p
						class="mt-2 text-3xl font-bold {snapshot.keyIndicators.previousMonthEvolutionPct !==
							null && snapshot.keyIndicators.previousMonthEvolutionPct >= 0
							? 'text-accent-ink'
							: 'text-ink-muted'}"
					>
						{#if snapshot.keyIndicators.previousMonthEvolutionPct !== null}
							{snapshot.keyIndicators.previousMonthEvolutionPct >= 0 ? '+' : ''}{snapshot
								.keyIndicators.previousMonthEvolutionPct} pts
						{:else}
							—
						{/if}
					</p>
					<span class="mt-1 block text-xs text-ink-muted">Par rapport au mois précédent</span>
				</div>
			</div>

			<!-- Tableau récapitulatif par collaborateur -->
			<div class="mt-8">
				<h3 class="text-sm font-semibold text-ink">Synthèse par collaborateur</h3>
				<div class="mt-3 overflow-x-auto rounded-xl border border-line">
					<table class="table w-full text-left text-sm">
						<thead class="bg-surface-muted/50 text-xs text-ink-muted">
							<tr>
								<th class="p-3 font-semibold">Collaborateur</th>
								<th class="p-3 font-semibold">Rôle</th>
								<th class="p-3 text-right font-semibold">Tâches assignées</th>
								<th class="p-3 text-right font-semibold">Tâches réalisées</th>
								<th class="p-3 text-right font-semibold">Taux moyen (%)</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-line">
							{#each snapshot.keyIndicators.membersSummary as m (m.memberId)}
								<tr class="hover:bg-surface-muted/20">
									<td class="p-3 font-semibold text-ink">{m.fullName}</td>
									<td class="p-3 text-xs text-ink-muted">
										{m.isChef ? 'Chef de département' : 'Membre'}
									</td>
									<td class="p-3 text-right font-mono text-xs">{m.assignedTasksCount}</td>
									<td class="p-3 text-right font-mono text-xs">{m.completedTasksCount}</td>
									<td class="p-3 text-right font-bold text-accent-ink">
										{m.averageProgressPct !== null ? `${m.averageProgressPct} %` : '—'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<!-- 3. Évolution hebdomadaire -->
		<section class="py-8" aria-labelledby="section-weekly">
			<h2 id="section-weekly" class="text-xl font-bold text-ink">3. Évolution hebdomadaire</h2>
			<p class="mt-1 text-xs text-ink-muted">
				Taux d'atteinte semaine par semaine pour l'ensemble des collaborateurs du département.
			</p>

			<div class="mt-4 overflow-x-auto rounded-xl border border-line">
				<table class="table w-full text-left text-sm">
					<thead class="bg-surface-muted/50 text-xs text-ink-muted">
						<tr>
							<th class="p-3 font-semibold">Collaborateur</th>
							{#each snapshot.weeklyEvolution.weeks as col (col.weekStart)}
								<th class="p-3 text-center font-semibold">
									{col.label}
									<span class="block text-[10px] font-normal text-ink-muted"
										>({col.periodLabel})</span
									>
								</th>
							{/each}
							<th class="p-3 text-right font-semibold">Moyenne</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each snapshot.weeklyEvolution.matrixRows as row (row.memberId)}
							<tr class="hover:bg-surface-muted/20">
								<td class="p-3 font-semibold text-ink">{row.fullName}</td>
								{#each snapshot.weeklyEvolution.weeks as col (col.weekStart)}
									{@const rate = row.ratesByWeek[col.weekStart]}
									<td class="p-3 text-center text-xs">
										{#if rate !== null && rate !== undefined}
											<span class="rounded bg-surface-muted px-2 py-0.5 font-semibold text-ink">
												{rate} %
											</span>
										{:else}
											<span class="text-ink-muted">—</span>
										{/if}
									</td>
								{/each}
								<td class="p-3 text-right font-bold text-accent-ink">
									{row.monthlyAveragePct !== null ? `${row.monthlyAveragePct} %` : '—'}
								</td>
							</tr>
						{/each}
						<!-- Team Weekly Average Footer -->
						<tr class="bg-surface-muted/40 font-semibold">
							<td class="p-3 text-ink">Moyenne équipe</td>
							{#each snapshot.weeklyEvolution.weeks as col (col.weekStart)}
								{@const teamRate = snapshot.weeklyEvolution.teamWeeklyAverages[col.weekStart]}
								<td class="p-3 text-center text-xs font-bold text-accent-ink">
									{teamRate !== null && teamRate !== undefined ? `${teamRate} %` : '—'}
								</td>
							{/each}
							<td class="p-3 text-right font-bold text-accent-ink">
								{snapshot.keyIndicators.teamAverageProgressPct !== null
									? `${snapshot.keyIndicators.teamAverageProgressPct} %`
									: '—'}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- 4. Bilan individuel par membre -->
		<section class="py-8" aria-labelledby="section-reviews">
			<h2 id="section-reviews" class="text-xl font-bold text-ink">
				4. Bilan individuel des collaborateurs
			</h2>

			<div class="mt-6 space-y-6">
				{#each snapshot.memberReviews as review (review.memberId)}
					<div class="rounded-xl border border-line bg-surface p-5 sm:p-6">
						<div
							class="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4"
						>
							<div>
								<h3 class="text-lg font-bold text-ink">{review.fullName}</h3>
								<p class="font-mono text-xs text-ink-muted">
									{review.username} · {review.isChef ? 'Chef de département' : 'Membre'}
								</p>
							</div>
							<div class="text-right">
								<span class="font-serif text-xl font-bold text-accent-ink">
									{review.monthlyAveragePct !== null ? `${review.monthlyAveragePct} %` : '—'}
								</span>
								<span class="block text-xs text-ink-muted"
									>{review.totalCompletedTasks} tâche(s) réalisée(s)</span
								>
							</div>
						</div>

						<div class="mt-4 space-y-4">
							{#each review.weeks as w (w.weekStart)}
								<div class="rounded-lg border border-line/50 bg-surface-muted/20 p-4">
									<div class="flex items-center justify-between">
										<span class="text-xs font-bold text-ink">Semaine {w.weekNumber}</span>
										<span
											class="rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink"
										>
											{w.progressPct !== null ? `${w.progressPct} %` : '—'}
										</span>
									</div>

									{#if w.completedTasks.length > 0}
										<ul class="mt-3 divide-y divide-line/30 text-xs">
											{#each w.completedTasks as t, i (i)}
												<li class="flex items-start justify-between gap-2 py-1.5">
													<div class="space-y-0.5">
														<span class="font-medium text-ink">✓ {t.title}</span>
														{#if t.note}
															<p class="text-[11px] text-ink-muted italic">« {t.note} »</p>
														{/if}
													</div>
													{#if t.doneOn}
														<span class="shrink-0 font-mono text-[10px] text-ink-muted"
															>{t.doneOn}</span
														>
													{/if}
												</li>
											{/each}
										</ul>
									{:else}
										<p class="mt-2 text-xs text-ink-muted italic">
											Aucune tâche validée cette semaine.
										</p>
									{/if}

									{#if w.difficulties}
										<div
											class="mt-3 rounded border border-warning/30 bg-warning-soft/20 p-2.5 text-xs text-warning"
										>
											<span class="font-semibold">Difficultés :</span>
											{w.difficulties}
										</div>
									{/if}

									{#if w.chefComment}
										<div
											class="mt-2 rounded border border-line bg-surface p-2.5 text-xs text-ink-muted"
										>
											<span class="font-semibold text-ink">Commentaire du chef :</span>
											{w.chefComment}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- 5. Difficultés récurrentes -->
		<section class="py-8" aria-labelledby="section-diff">
			<h2 id="section-diff" class="text-xl font-bold text-ink">
				5. Difficultés récurrentes & Points de vigilance
			</h2>

			{#if snapshot.recurringDifficulties.length === 0}
				<p class="mt-4 text-sm text-ink-muted italic">
					Aucune difficulté récurrente majeure signalée au cours de ce mois.
				</p>
			{:else}
				<ul class="mt-4 space-y-2">
					{#each snapshot.recurringDifficulties as diff, i (i)}
						<li
							class="rounded-xl border border-warning/30 bg-warning-soft/20 p-3.5 text-sm leading-relaxed text-ink"
						>
							⚠️ {diff}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- 6. Perspectives -->
		<section class="py-8" aria-labelledby="section-persp">
			<h2 id="section-persp" class="text-xl font-bold text-ink">6. Perspectives & Priorités</h2>

			{#if snapshot.perspectives.length === 0}
				<p class="mt-4 text-sm text-ink-muted italic">
					Poursuite des activités opérationnelles courantes pour le mois à venir.
				</p>
			{:else}
				<ul class="mt-4 space-y-2">
					{#each snapshot.perspectives as persp, i (i)}
						<li
							class="rounded-xl border border-line bg-surface p-3.5 text-sm leading-relaxed text-ink"
						>
							→ {persp}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- 7. Conclusion -->
		<section class="py-8" aria-labelledby="section-conclusion">
			<h2 id="section-conclusion" class="text-xl font-bold text-ink">
				7. Conclusion du responsable
			</h2>
			<div
				class="mt-4 rounded-xl border border-line bg-surface-muted/30 p-5 text-sm leading-relaxed text-ink"
			>
				{snapshot.conclusionText}
			</div>
		</section>

		<!-- Annexe : Rapports hebdomadaires consolidés -->
		<section class="pt-8" aria-labelledby="section-annex">
			<h2 id="section-annex" class="text-xl font-bold text-ink">
				Annexe — Rapports hebdomadaires consolidés
			</h2>
			<p class="mt-1 text-xs text-ink-muted">
				Liste des {snapshot.annexReports.length} rapports hebdomadaires validés et publiés intégrés dans
				cet instantané.
			</p>

			<div class="mt-4 overflow-x-auto rounded-xl border border-line">
				<table class="table w-full text-left text-sm">
					<thead class="bg-surface-muted/50 text-xs text-ink-muted">
						<tr>
							<th class="p-3 font-semibold">Semaine</th>
							<th class="p-3 font-semibold">Collaborateur</th>
							<th class="p-3 font-semibold">Version</th>
							<th class="p-3 font-semibold">Date de publication</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line text-xs">
						{#each snapshot.annexReports as r (r.reportId)}
							<tr class="hover:bg-surface-muted/20">
								<td class="p-3 font-bold text-ink">Semaine {r.weekNumber}</td>
								<td class="p-3 text-ink">{r.memberName}</td>
								<td class="p-3 font-mono">v{r.version}</td>
								<td class="p-3 text-ink-muted">{formatDateTime(r.publishedAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</article>
</div>
