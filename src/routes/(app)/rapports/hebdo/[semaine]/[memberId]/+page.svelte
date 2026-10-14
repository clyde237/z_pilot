<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Download from '@lucide/svelte/icons/download';
	import Lock from '@lucide/svelte/icons/lock';
	import Send from '@lucide/svelte/icons/send';
	import Unlock from '@lucide/svelte/icons/unlock';
	import Alert from '#lib/components/ui/Alert.svelte';
	import type { WeeklyReportSnapshot } from '#lib/domain/reports.js';
	import { TASK_WEIGHT_LABELS } from '#lib/domain/tasks.js';
	import { formatWeekLabel } from '#lib/format.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const weekLabel = $derived(formatWeekLabel(data.weekStart));
	const isPublished = $derived(data.publishedReport !== null);
	const snapshot = $derived(
		data.publishedReport ? (data.publishedReport.snapshot as unknown as WeeklyReportSnapshot) : null
	);

	let showReopenModal = $state(false);
	let reopenReason = $state('');

	let chefComment = $state('');
	let nextWeekCustomText = $state('');
	let isSubmitting = $state(false);

	$effect(() => {
		chefComment = data.prep.defaultChefComment;
		nextWeekCustomText = data.prep.defaultNextWeekText;
	});

	function formatDate(d: Date | string): string {
		return new Date(d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.prep.member.fullName} · {weekLabel} · Rapport hebdomadaire</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Top Bar -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<a
			href={resolve('/(app)/rapports/hebdo/[semaine]', { semaine: data.weekStart })}
			class="btn btn-secondary inline-flex items-center gap-2 text-sm"
		>
			<ArrowLeft class="size-4" aria-hidden="true" />
			Retour aux rapports
		</a>

		{#if isPublished && data.publishedReport}
			<div class="flex items-center gap-2">
				<a
					href={resolve('/api/export/hebdo/[id]', { id: data.publishedReport.id })}
					download
					class="btn btn-secondary inline-flex items-center gap-2 text-sm"
				>
					<Download class="size-4" aria-hidden="true" />
					Exporter Word (.docx)
				</a>

				<button
					type="button"
					onclick={() => (showReopenModal = true)}
					class="btn btn-secondary inline-flex items-center gap-1.5 text-sm text-danger"
				>
					<Unlock class="size-4" aria-hidden="true" />
					Rouvrir le rapport
				</button>
			</div>
		{/if}
	</div>

	{#if form?.error}
		<Alert tone="danger">{form.error}</Alert>
	{/if}

	{#if form?.success && !form?.reopened}
		<Alert tone="success">
			Rapport publié avec succès ! Les tâches du membre pour cette semaine sont désormais
			verrouillées.
		</Alert>
	{/if}

	{#if form?.reopened}
		<Alert tone="warning">
			Le rapport a été rouvert. Les tâches du membre sont déverrouillées pour correction.
		</Alert>
	{/if}

	{#if !isPublished && data.prep.existingReport?.status === 'reopened'}
		<Alert tone="warning">
			Ce rapport a été rouvert précédemment (motif : « {data.prep.existingReport.reopenedReason} »). Vous
			préparez la republication (v{(data.prep.existingReport.version ?? 1) + 1}).
		</Alert>
	{/if}

	<!-- Reopen Dialog Modal (EF-HEB-06) -->
	{#if showReopenModal && data.publishedReport}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
			role="dialog"
			aria-modal="true"
		>
			<div class="card w-full max-w-lg space-y-4 p-6 shadow-xl">
				<div class="flex items-center gap-2 text-warning">
					<Unlock class="size-5 shrink-0" aria-hidden="true" />
					<h2 class="text-lg font-semibold text-ink">Rouvrir le rapport hebdomadaire</h2>
				</div>

				<p class="text-sm text-ink-muted">
					La réouverture déverrouille les tâches de <span class="font-medium text-ink"
						>{data.prep.member.fullName}</span
					>
					pour lui permettre d’apporter des corrections. Conformément à la règle
					<span class="font-semibold text-ink">RG-06</span>, un motif de réouverture est obligatoire
					et sera tracé dans le journal d’audit.
				</p>

				<form method="POST" action="?/reopen" class="space-y-4">
					<input type="hidden" name="reportId" value={data.publishedReport.id} />

					<div>
						<label for="reopenedReason" class="field-label">
							Motif de la réouverture <span class="text-danger">*</span>
						</label>
						<textarea
							id="reopenedReason"
							name="reopenedReason"
							rows="3"
							bind:value={reopenReason}
							required
							minlength="3"
							maxlength="500"
							placeholder="Ex. Tâche oubliée, précision sur le montant du contrat..."
							class="input mt-1 w-full resize-y text-sm"></textarea>
						<p class="mt-1 text-xs text-ink-muted">Minimum 3 caractères.</p>
					</div>

					<div class="flex items-center justify-end gap-3 pt-2">
						<button
							type="button"
							onclick={() => (showReopenModal = false)}
							class="btn btn-secondary text-sm"
						>
							Annuler
						</button>
						<button
							type="submit"
							disabled={reopenReason.trim().length < 3}
							class="btn btn-primary text-sm"
						>
							Confirmer la réouverture
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- MAIN CONTENT -->
	{#if isPublished && snapshot}
		<!-- READ-ONLY PUBLISHED REPORT VIEW -->
		<article class="card divide-y divide-line p-6 sm:p-8">
			<div class="pb-6">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<span
							class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success"
						>
							<Lock class="size-3.5" aria-hidden="true" />
							Publié (v{data.publishedReport?.version})
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
					</div>

					<div class="rounded-xl border border-line p-5">
						<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
							Points pondérés
						</p>
						<p class="mt-2 text-2xl font-bold text-ink">
							{snapshot.progression.achievedWeight} / {snapshot.progression.totalWeight}
						</p>
					</div>
				</div>
			</section>

			<!-- 2. Activités réalisées par jour -->
			<section class="py-6">
				<h2 class="text-lg font-semibold text-ink">2. Activités réalisées (par jour)</h2>
				{#if snapshot.completedTasksByDay.length === 0}
					<p class="mt-3 text-sm text-ink-muted italic">Aucune tâche complétée cette semaine.</p>
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
									<span class="text-xs text-ink-muted">{dayGroup.tasks.length} tâche(s)</span>
								</div>
								<div class="divide-y divide-line">
									{#each dayGroup.tasks as task (task.id)}
										<div class="flex items-start gap-3 p-4">
											<CheckCircle2
												class="mt-0.5 size-4 shrink-0 text-success"
												aria-hidden="true"
											/>
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
														({TASK_WEIGHT_LABELS[task.weight]?.shortLabel ??
															`Poids ${task.weight}`})
													</span>
												</div>
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

			<!-- 3. Tâches non réalisées -->
			<section class="py-6">
				<h2 class="text-lg font-semibold text-ink">3. Tâches non réalisées ou partielles</h2>
				{#if snapshot.uncompletedOrPartialTasks.length === 0}
					<div
						class="mt-3 rounded-lg border border-success/30 bg-success-soft/30 p-3 text-sm text-success"
					>
						Toutes les tâches ont été réalisées.
					</div>
				{:else}
					<div class="mt-4 divide-y divide-line rounded-xl border border-line">
						{#each snapshot.uncompletedOrPartialTasks as task (task.id)}
							<div class="p-4">
								<p class="text-sm font-medium text-ink">{task.title}</p>
								{#if task.note}
									<p class="mt-1 text-xs text-ink italic">Motif : {task.note}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- 4. Difficultés -->
			<section class="py-6">
				<h2 class="text-lg font-semibold text-ink">4. Difficultés rencontrées</h2>
				<div class="mt-3 rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
					{snapshot.difficulties || 'Aucune difficulté signalée.'}
				</div>
			</section>

			<!-- 5. Commentaire du chef -->
			<section class="py-6">
				<h2 class="text-lg font-semibold text-ink">5. Commentaire du chef de département</h2>
				<div class="mt-3 rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
					{snapshot.chefComment || 'Aucun commentaire particulier.'}
				</div>
			</section>

			<!-- 6. Plan semaine suivante -->
			<section class="pt-6">
				<h2 class="text-lg font-semibold text-ink">6. Plan de la semaine suivante</h2>
				{#if snapshot.nextWeekPlan.plannedTasks.length > 0}
					<div class="mt-3 mb-3 divide-y divide-line rounded-xl border border-line">
						{#each snapshot.nextWeekPlan.plannedTasks as nextTask (nextTask.id)}
							<div class="flex items-center justify-between p-3 text-sm">
								<span class="font-medium text-ink">{nextTask.title}</span>
								<span class="text-xs text-ink-muted">
									{TASK_WEIGHT_LABELS[nextTask.weight]?.shortLabel ?? `Poids ${nextTask.weight}`}
								</span>
							</div>
						{/each}
					</div>
				{/if}
				{#if snapshot.nextWeekPlan.customText}
					<div class="rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
						{snapshot.nextWeekPlan.customText}
					</div>
				{/if}
			</section>
		</article>
	{:else}
		<!-- DRAFT & PUBLICATION FORM -->
		<form
			method="POST"
			action="?/publish"
			onsubmit={() => {
				isSubmitting = true;
			}}
			class="space-y-6"
		>
			<article class="card divide-y divide-line p-6 sm:p-8">
				<!-- Header -->
				<div class="pb-6">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-muted"
							>
								Projet en préparation
							</span>
							<h1 class="mt-3 text-2xl font-bold sm:text-3xl">Aperçu avant publication</h1>
							<p class="mt-1 text-base text-ink-muted">
								Rapport d’activité de <span class="font-semibold text-ink"
									>{data.prep.member.fullName}</span
								>
								· {weekLabel}
							</p>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							class="btn btn-primary inline-flex items-center gap-2 text-sm shadow-md"
						>
							<Send class="size-4" aria-hidden="true" />
							Publier le rapport
						</button>
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
								{data.prep.progression.progressPct !== null
									? `${data.prep.progression.progressPct} %`
									: '—'}
							</p>
							<p class="mt-1 text-xs text-ink-muted">
								{data.prep.progression.progressPct !== null
									? 'Sur objectifs assignés'
									: 'Aucun objectif défini'}
							</p>
						</div>

						<div class="rounded-xl border border-line p-5">
							<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
								Tâches terminées
							</p>
							<p class="mt-2 text-2xl font-bold text-ink">
								{data.prep.progression.completedTasksCount} / {data.prep.progression
									.totalTasksCount}
							</p>
						</div>

						<div class="rounded-xl border border-line p-5">
							<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
								Points pondérés
							</p>
							<p class="mt-2 text-2xl font-bold text-ink">
								{data.prep.progression.achievedWeight} / {data.prep.progression.totalWeight}
							</p>
						</div>
					</div>
				</section>

				<!-- 2. Activités réalisées -->
				<section class="py-6">
					<h2 class="text-lg font-semibold text-ink">2. Activités réalisées</h2>
					{#if data.prep.tasks.filter((t) => t.isDone).length === 0}
						<p class="mt-3 text-sm text-ink-muted italic">Aucune tâche complétée pour l'instant.</p>
					{:else}
						<div class="mt-4 divide-y divide-line rounded-xl border border-line">
							{#each data.prep.tasks.filter((t) => t.isDone) as task (task.id)}
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
												({TASK_WEIGHT_LABELS[task.weight]?.shortLabel ?? `Poids ${task.weight}`})
											</span>
										</div>
										{#if task.note}
											<p class="mt-1 text-xs text-ink italic">Note du membre : {task.note}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<!-- 3. Tâches non réalisées -->
				<section class="py-6">
					<h2 class="text-lg font-semibold text-ink">3. Tâches non réalisées ou partielles</h2>
					{#if data.prep.tasks.filter((t) => !t.isDone).length === 0}
						<div
							class="mt-3 rounded-lg border border-success/30 bg-success-soft/30 p-3 text-sm text-success"
						>
							Toutes les tâches prévues ont été réalisées à 100 %.
						</div>
					{:else}
						<div class="mt-4 divide-y divide-line rounded-xl border border-line">
							{#each data.prep.tasks.filter((t) => !t.isDone) as task (task.id)}
								<div class="p-4">
									<div class="flex items-center justify-between">
										<span class="text-sm font-medium text-ink">{task.title}</span>
										<span class="text-xs font-medium text-danger">Non réalisée</span>
									</div>
									{#if task.note}
										<p class="mt-1 text-xs text-ink italic">Motif / Note : {task.note}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<!-- 4. Difficultés -->
				<section class="py-6">
					<h2 class="text-lg font-semibold text-ink">4. Difficultés rencontrées</h2>
					<div class="mt-3 rounded-xl border border-line bg-surface-muted/30 p-4 text-sm text-ink">
						{data.prep.difficulties || 'Aucune difficulté signalée par le membre.'}
					</div>
				</section>

				<!-- 5. Commentaire du chef (Saisie EF-HEB-03) -->
				<section class="space-y-2 py-6">
					<div class="flex items-center justify-between">
						<label for="chefComment" class="text-lg font-semibold text-ink">
							5. Commentaire du chef de département
						</label>
						<span class="text-xs text-ink-muted">Éditable avant publication</span>
					</div>
					<textarea
						id="chefComment"
						name="chefComment"
						rows="4"
						bind:value={chefComment}
						maxlength="2000"
						placeholder="Ajoutez vos appréciations, remarques ou encouragements sur la semaine écoulée..."
						class="input mt-1 w-full resize-y text-sm"></textarea>
				</section>

				<!-- 6. Plan semaine suivante (EF-HEB-03) -->
				<section class="space-y-4 pt-6">
					<div class="flex items-center justify-between">
						<h2 class="text-lg font-semibold text-ink">6. Plan de la semaine suivante</h2>
						<span class="text-xs text-ink-muted">Pré-rempli avec les tâches S+1</span>
					</div>

					{#if data.prep.nextWeekPlannedTasks.length > 0}
						<div class="divide-y divide-line rounded-xl border border-line">
							{#each data.prep.nextWeekPlannedTasks as nextTask (nextTask.id)}
								<div class="flex items-center justify-between p-3 text-sm">
									<span class="font-medium text-ink">{nextTask.title}</span>
									<span class="text-xs text-ink-muted">
										{TASK_WEIGHT_LABELS[nextTask.weight]?.shortLabel ?? `Poids ${nextTask.weight}`}
									</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-ink-muted italic">
							Aucune tâche n'a encore été assignée pour la semaine suivante dans le module
							Objectifs.
						</p>
					{/if}

					<div>
						<label for="nextWeekCustomText" class="field-label">
							Consignes ou priorités complémentaires pour la semaine suivante
						</label>
						<textarea
							id="nextWeekCustomText"
							name="nextWeekCustomText"
							rows="3"
							bind:value={nextWeekCustomText}
							maxlength="2000"
							placeholder="Instructions libres, jalons ou points d’attention pour la semaine prochaine..."
							class="input mt-1 w-full resize-y text-sm"></textarea>
					</div>
				</section>

				<!-- Submit action bar -->
				<div class="flex items-center justify-end gap-3 border-t border-line pt-6">
					<a
						href={resolve('/(app)/rapports/hebdo/[semaine]', { semaine: data.weekStart })}
						class="btn btn-secondary text-sm"
					>
						Annuler
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="btn btn-primary inline-flex items-center gap-2 text-sm shadow-md"
					>
						<Send class="size-4" aria-hidden="true" />
						{data.prep.existingReport?.status === 'reopened'
							? 'Republier le rapport'
							: 'Publier le rapport'}
					</button>
				</div>
			</article>
		</form>
	{/if}
</div>
