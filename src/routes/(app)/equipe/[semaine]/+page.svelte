<script lang="ts">
	import { resolve } from '$app/paths';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Circle from '@lucide/svelte/icons/circle';
	import FileText from '@lucide/svelte/icons/file-text';
	import Target from '@lucide/svelte/icons/target';
	import { ISO_DAY_NAMES, TASK_WEIGHT_LABELS } from '#lib/domain/tasks.js';
	import { formatWeekLabel, initialsOf } from '#lib/format.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const weekLabel = $derived(formatWeekLabel(data.weekStart));
	const inactiveCount = $derived(data.overview.members.filter((m) => m.hasNoRecentActivity).length);

	let expandedMemberIds = $state<Record<string, boolean>>({});

	function toggleExpand(id: string) {
		expandedMemberIds[id] = !expandedMemberIds[id];
	}
</script>

<svelte:head>
	<title>Tableau de bord équipe · {weekLabel} · Z_Pilot</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="eyebrow">Supervision</p>
			<h1 class="mt-1 text-3xl font-semibold">Tableau de bord de l’équipe</h1>
			<p class="mt-1 text-ink-muted">
				Suivez l’avancement hebdomadaire, l’activité des membres et l’état des rapports.
			</p>
		</div>

		<!-- Week Navigation -->
		<div
			class="inline-flex items-center gap-1 self-start rounded-lg border border-line bg-surface p-1 text-sm shadow-xs sm:self-auto"
		>
			<a
				href={resolve('/(app)/equipe/[semaine]', { semaine: data.prevWeek })}
				class="btn btn-ghost px-2.5 py-1.5"
				title="Semaine précédente"
			>
				<ArrowLeft class="size-4" aria-hidden="true" />
			</a>
			<span class="px-2 font-medium text-ink">
				{weekLabel}
			</span>
			<a
				href={resolve('/(app)/equipe/[semaine]', { semaine: data.nextWeek })}
				class="btn btn-ghost px-2.5 py-1.5"
				title="Semaine suivante"
			>
				<ArrowRight class="size-4" aria-hidden="true" />
			</a>
		</div>
	</div>

	<!-- Quick Links -->
	<div class="flex flex-wrap items-center gap-3">
		<a
			href={resolve('/(app)/equipe/objectifs/[semaine]', { semaine: data.weekStart })}
			class="btn btn-secondary inline-flex items-center gap-2 text-sm"
		>
			<Target class="size-4" aria-hidden="true" />
			Gérer les objectifs ({data.overview.totalTasks} tâches)
		</a>

		<a
			href={resolve('/(app)/rapports/hebdo/[semaine]', { semaine: data.weekStart })}
			class="btn btn-secondary inline-flex items-center gap-2 text-sm"
		>
			<FileText class="size-4" aria-hidden="true" />
			Rapports hebdomadaires ({data.overview.publishedCount}/{data.overview.totalMembers})
		</a>
	</div>

	<!-- Metrics Grid (EF-DAS-04, EF-DAS-05) -->
	<div class="grid gap-4 sm:grid-cols-4">
		<div class="card p-5">
			<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Avancement moyen</p>
			<p class="mt-2 text-3xl font-extrabold text-accent-ink">
				{data.overview.teamAverageProgressPct !== null
					? `${data.overview.teamAverageProgressPct} %`
					: '—'}
			</p>
			<p class="mt-1 text-xs text-ink-muted">Pondéré selon criticité (RG-03)</p>
		</div>

		<div class="card p-5">
			<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Tâches réalisées</p>
			<p class="mt-2 text-3xl font-bold text-ink">
				{data.overview.totalDoneTasks}
				<span class="text-lg font-normal text-ink-muted">/ {data.overview.totalTasks}</span>
			</p>
			<p class="mt-1 text-xs text-ink-muted">Sur toute l'équipe</p>
		</div>

		<div class="card p-5">
			<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Rapports validés</p>
			<p class="mt-2 text-3xl font-bold text-ink">
				{data.overview.publishedCount}
				<span class="text-lg font-normal text-ink-muted">/ {data.overview.totalMembers}</span>
			</p>
			<p class="mt-1 text-xs text-ink-muted">
				{data.overview.totalMembers - data.overview.publishedCount} en attente
			</p>
		</div>

		<div class="card p-5 {inactiveCount > 0 ? 'border-warning/30 bg-warning-soft/10' : ''}">
			<div class="flex items-center justify-between">
				<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
					Sans activité récente
				</p>
				{#if inactiveCount > 0}
					<AlertTriangle class="size-4 text-warning" aria-hidden="true" />
				{/if}
			</div>
			<p class="mt-2 text-3xl font-bold {inactiveCount > 0 ? 'text-warning' : 'text-ink'}">
				{inactiveCount}
			</p>
			<p class="mt-1 text-xs text-ink-muted">
				{inactiveCount > 0 ? 'Membre(s) sans tâche cochée' : 'Tous actifs'}
			</p>
		</div>
	</div>

	<!-- Team Members List (EF-DAS-01, EF-DAS-02) -->
	<div class="card divide-y divide-line overflow-hidden">
		<div class="flex items-center justify-between border-b border-line px-6 py-4">
			<h2 class="text-base font-semibold text-ink">Activité détaillée des collaborateurs</h2>
			<span class="text-xs text-ink-muted">
				Semaine du {data.weekStart}
			</span>
		</div>

		{#each data.overview.members as item (item.member.id)}
			{@const isExpanded = expandedMemberIds[item.member.id] ?? false}
			<div class="p-6 transition hover:bg-surface-muted/10">
				<!-- Member Header Row -->
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex min-w-0 items-center gap-3 sm:w-1/3">
						<span
							class="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-ink"
						>
							{initialsOf(item.member.fullName)}
						</span>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<p class="truncate font-semibold text-ink">{item.member.fullName}</p>
								{#if item.member.isChef}
									<span class="badge text-[10px]">Chef</span>
								{/if}
								{#if item.hasNoRecentActivity}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning"
									>
										<AlertTriangle class="size-3" aria-hidden="true" />
										Inactif
									</span>
								{/if}
							</div>
							<p class="text-xs text-ink-muted">@{item.member.username}</p>
						</div>
					</div>

					<!-- Progress Bar -->
					<div class="sm:w-1/4">
						<div class="mb-1 flex items-center justify-between text-xs">
							<span class="text-ink-muted">
								{item.doneTasksCount} / {item.tasksCount} tâche(s)
							</span>
							<span class="font-bold text-ink">
								{item.progression.progressPct !== null
									? `${item.progression.progressPct} %`
									: 'Sans tâche'}
							</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
							<div
								class="h-full bg-accent transition-all duration-300"
								style="width: {item.progression.progressPct ?? 0}%"
							></div>
						</div>
					</div>

					<!-- Report Status Badge -->
					<div class="sm:w-1/6">
						{#if item.report?.status === 'published'}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
							>
								Rapport publié (v{item.report.version})
							</span>
						{:else if item.report?.status === 'reopened'}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning"
							>
								Rapport rouvert (v{item.report.version})
							</span>
						{:else}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted"
							>
								Non publié
							</span>
						{/if}
					</div>

					<!-- Action Controls -->
					<div class="flex items-center gap-2 sm:justify-end">
						<a
							href={resolve('/(app)/rapports/hebdo/[semaine]/[memberId]', {
								semaine: data.weekStart,
								memberId: item.member.id
							})}
							class="btn btn-secondary px-2.5 py-1.5 text-xs"
						>
							{item.report?.status === 'published' ? 'Voir rapport' : 'Gérer rapport'}
						</a>

						<button
							type="button"
							onclick={() => toggleExpand(item.member.id)}
							class="btn btn-ghost inline-flex items-center gap-1 px-2 py-1.5 text-xs"
							aria-expanded={isExpanded}
						>
							{#if isExpanded}
								<ChevronUp class="size-4" aria-hidden="true" />
							{:else}
								<ChevronDown class="size-4" aria-hidden="true" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Collapsible Member Detail (EF-DAS-02) -->
				{#if isExpanded}
					<div class="mt-5 space-y-4 border-t border-line pt-4">
						<!-- Difficulties Section -->
						{#if item.difficulties}
							<div class="rounded-lg border border-warning/20 bg-warning-soft/20 p-3 text-xs">
								<p class="mb-1 font-semibold text-warning">
									Difficultés signalées par le collaborateur :
								</p>
								<p class="text-ink">{item.difficulties}</p>
							</div>
						{/if}

						<!-- Tasks List -->
						<div>
							<h3 class="mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase">
								Objectifs de la semaine ({item.tasks.length})
							</h3>

							{#if item.tasks.length === 0}
								<p class="text-xs text-ink-muted italic">
									Aucun objectif défini pour cette semaine.
								</p>
							{:else}
								<div class="divide-y divide-line rounded-lg border border-line bg-surface">
									{#each item.tasks as task (task.id)}
										<div class="flex items-start gap-3 p-3 text-xs">
											{#if task.isDone}
												<CheckCircle2
													class="mt-0.5 size-4 shrink-0 text-success"
													aria-hidden="true"
												/>
											{:else}
												<Circle class="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
											{/if}
											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center gap-2">
													<span
														class="font-medium {task.isDone
															? 'text-ink-muted line-through'
															: 'text-ink'}"
													>
														{task.title}
													</span>
													{#if task.targetValue != null && task.targetValue > 0}
														<span class="badge text-[10px]">
															{task.achievedValue ?? 0} / {task.targetValue}
															{task.unit ?? ''}
														</span>
													{/if}
													<span class="text-[10px] text-ink-muted">
														{TASK_WEIGHT_LABELS[task.weight] ?? `Poids ${task.weight}`}
													</span>
													{#if task.plannedDay}
														<span class="text-[10px] text-ink-muted">
															· Prévu {ISO_DAY_NAMES[task.plannedDay]}
														</span>
													{/if}
												</div>

												{#if task.description}
													<p class="mt-0.5 text-ink-muted">{task.description}</p>
												{/if}

												{#if task.note}
													<p class="mt-1 rounded bg-surface-muted/30 p-1.5 text-ink italic">
														Note : {task.note}
													</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
