<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Download from '@lucide/svelte/icons/download';
	import Lock from '@lucide/svelte/icons/lock';
	import { TASK_WEIGHT_LABELS } from '#lib/domain/tasks.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const snapshot = $derived(data.snapshot);
	const backLink = $derived(
		data.isChef
			? resolve('/(app)/rapports/hebdo/[semaine]', { semaine: data.report.weekStart })
			: resolve('/(app)/mes-rapports')
	);

	function formatDate(d: Date | string): string {
		return new Date(d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{snapshot.weekLabel} · {snapshot.member.fullName} · Rapport</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Top Bar -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<a href={backLink} class="btn btn-secondary inline-flex items-center gap-2 text-sm">
			<ArrowLeft class="size-4" aria-hidden="true" />
			Retour
		</a>

		<a
			href={resolve('/api/export/hebdo/[id]', { id: data.report.id })}
			download
			class="btn btn-primary inline-flex items-center gap-2 text-sm"
		>
			<Download class="size-4" aria-hidden="true" />
			Télécharger en Word (.docx)
		</a>
	</div>

	<!-- Main Report Card -->
	<article class="card divide-y divide-line p-6 sm:p-8">
		<!-- Header -->
		<div class="pb-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success"
					>
						<Lock class="size-3.5" aria-hidden="true" />
						Rapport validé & publié (v{data.report.version})
					</span>
					<h1 class="mt-3 text-2xl font-bold sm:text-3xl">Rapport d’activité hebdomadaire</h1>
					<p class="mt-1 text-base text-ink-muted">
						{snapshot.member.fullName} ·
						<span class="font-medium text-ink">{snapshot.weekLabel}</span>
					</p>
				</div>

				<div
					class="rounded-lg border border-line bg-surface-muted/50 p-3 text-right text-xs text-ink-muted"
				>
					<p>
						<span class="font-medium text-ink">Organisation :</span>
						{snapshot.organizationName || 'Zingana'}
					</p>
					<p class="mt-0.5">
						<span class="font-medium text-ink">Département :</span>
						{snapshot.departmentName || 'Technique'}
					</p>
					<p class="mt-0.5">
						<span class="font-medium text-ink">Date :</span>
						{formatDate(snapshot.publishedAt)}
					</p>
					<p class="mt-0.5">
						<span class="font-medium text-ink">Par :</span>
						{snapshot.publishedBy.fullName}
					</p>
				</div>
			</div>
		</div>

		<!-- 1. Synthèse -->
		<section class="py-6">
			<h2 class="text-lg font-semibold text-ink">1. Synthèse des objectifs</h2>
			<div class="mt-4 grid gap-4 sm:grid-cols-3">
				<div class="rounded-xl border border-line bg-accent-soft/30 p-5 text-center">
					<p class="text-xs font-semibold tracking-wider text-accent-ink uppercase">
						Taux d’atteinte
					</p>
					<p class="mt-2 text-3xl font-extrabold text-accent-ink">
						{snapshot.progression.progressPct !== null
							? `${snapshot.progression.progressPct} %`
							: '—'}
					</p>
					<p class="mt-1 text-xs text-ink-muted">
						{snapshot.progression.progressPct !== null
							? 'Sur objectifs assignés'
							: 'Aucun objectif défini'}
					</p>
				</div>

				<div class="rounded-xl border border-line p-5">
					<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
						Tâches terminées
					</p>
					<p class="mt-2 text-2xl font-bold text-ink">
						{snapshot.progression.completedTasksCount} / {snapshot.progression.totalTasksCount}
					</p>
					<p class="mt-1 text-xs text-ink-muted">Tâches planifiées sur la semaine</p>
				</div>

				<div class="rounded-xl border border-line p-5">
					<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
						Points pondérés
					</p>
					<p class="mt-2 text-2xl font-bold text-ink">
						{snapshot.progression.achievedWeight} / {snapshot.progression.totalWeight}
					</p>
					<p class="mt-1 text-xs text-ink-muted">Selon barème de criticité (1, 2, 3)</p>
				</div>
			</div>
		</section>

		<!-- 2. Activités réalisées par jour -->
		<section class="py-6">
			<h2 class="text-lg font-semibold text-ink">2. Activités réalisées (par jour)</h2>

			{#if snapshot.completedTasksByDay.length === 0}
				<p class="mt-3 text-sm text-ink-muted italic">
					Aucune tâche n'a été complétée sur cette période.
				</p>
			{:else}
				<div class="mt-4 space-y-4">
					{#each snapshot.completedTasksByDay as dayGroup, idx (dayGroup.date ?? idx)}
						{@const dayDateFr = new Date(dayGroup.date).toLocaleDateString('fr-FR', {
							day: 'numeric',
							month: 'long'
						})}
						<div class="overflow-hidden rounded-xl border border-line">
							<div
								class="flex items-center justify-between border-b border-line bg-surface-muted/60 px-4 py-2"
							>
								<span class="text-sm font-semibold text-ink">
									{dayGroup.dayName}
									<span class="text-xs font-normal text-ink-muted">({dayDateFr})</span>
								</span>
								<span class="text-xs text-ink-muted">
									{dayGroup.tasks.length} tâche(s)
								</span>
							</div>

							<div class="divide-y divide-line">
								{#each dayGroup.tasks as task (task.id)}
									<div class="flex items-start gap-3 p-4">
										<CheckCircle2 class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-2">
												<span class="text-sm font-medium text-ink">{task.title}</span>
												{#if task.isQuantitative}
													<span class="badge text-xs">
														{task.achievedValue ?? 0} / {task.targetValue}
														{task.unit ?? ''}
													</span>
												{/if}
												<span class="text-xs text-ink-muted">
													({TASK_WEIGHT_LABELS[task.weight] ?? `Poids ${task.weight}`})
												</span>
											</div>
											{#if task.description}
												<p class="mt-1 text-xs text-ink-muted">{task.description}</p>
											{/if}
											{#if task.note}
												<p class="mt-1.5 rounded bg-surface-muted/40 p-2 text-xs text-ink italic">
													Note : {task.note}
												</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 3. Tâches non réalisées ou partielles -->
		<section class="py-6">
			<h2 class="text-lg font-semibold text-ink">3. Tâches non réalisées ou partielles</h2>

			{#if snapshot.uncompletedOrPartialTasks.length === 0}
				<div
					class="mt-3 rounded-lg border border-success/30 bg-success-soft/30 p-3 text-sm text-success"
				>
					Toutes les tâches prévues pour cette semaine ont été réalisées.
				</div>
			{:else}
				<div class="mt-4 divide-y divide-line rounded-xl border border-line">
					{#each snapshot.uncompletedOrPartialTasks as task (task.id)}
						<div class="p-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-sm font-medium text-ink">{task.title}</span>
								{#if task.isQuantitative}
									<span class="text-xs font-semibold text-warning">
										Partielle : {task.achievedValue ?? 0} / {task.targetValue}
										{task.unit ?? ''}
									</span>
								{:else}
									<span class="text-xs font-semibold text-danger">Non réalisée</span>
								{/if}
							</div>
							{#if task.description}
								<p class="mt-1 text-xs text-ink-muted">{task.description}</p>
							{/if}
							{#if task.note}
								<p class="mt-1.5 rounded bg-surface-muted/40 p-2 text-xs text-ink italic">
									Motif / Note : {task.note}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- 4. Difficultés rencontrées -->
		<section class="py-6">
			<h2 class="text-lg font-semibold text-ink">4. Difficultés rencontrées</h2>
			<div class="mt-3 rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
				{snapshot.difficulties || 'Aucune difficulté particulière signalée cette semaine.'}
			</div>
		</section>

		<!-- 5. Commentaire du chef -->
		<section class="py-6">
			<h2 class="text-lg font-semibold text-ink">5. Commentaire du chef de département</h2>
			<div class="mt-3 rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
				{snapshot.chefComment || 'Aucun commentaire particulier.'}
			</div>
		</section>

		<!-- 6. Plan de la semaine suivante -->
		<section class="pt-6">
			<h2 class="text-lg font-semibold text-ink">6. Plan de la semaine suivante</h2>

			{#if snapshot.nextWeekPlan.plannedTasks.length > 0}
				<div class="mt-3 divide-y divide-line rounded-xl border border-line">
					{#each snapshot.nextWeekPlan.plannedTasks as nextTask (nextTask.id)}
						<div class="flex items-center justify-between p-3.5 text-sm">
							<span class="font-medium text-ink">{nextTask.title}</span>
							<span class="text-xs text-ink-muted">
								{TASK_WEIGHT_LABELS[nextTask.weight] ?? `Poids ${nextTask.weight}`}
							</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if snapshot.nextWeekPlan.customText}
				<div class="mt-3 rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
					{snapshot.nextWeekPlan.customText}
				</div>
			{:else if snapshot.nextWeekPlan.plannedTasks.length === 0}
				<p class="mt-3 text-sm text-ink-muted italic">
					Aucun plan spécifique saisi pour la semaine suivante.
				</p>
			{/if}
		</section>
	</article>
</div>
