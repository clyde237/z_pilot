<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import Download from '@lucide/svelte/icons/download';
	import Eye from '@lucide/svelte/icons/eye';
	import FileText from '@lucide/svelte/icons/file-text';
	import Alert from '#lib/components/ui/Alert.svelte';
	import { formatWeekLabel, initialsOf } from '#lib/format.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const weekLabel = $derived(formatWeekLabel(data.weekStart));
	const pendingCount = $derived(data.overview.totalMembers - data.overview.publishedCount);

	let isBatchSubmitting = $state(false);
</script>

<svelte:head>
	<title>Rapports hebdomadaires · {weekLabel} · Z_Pilot</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="eyebrow">Validation & Suivi</p>
			<h1 class="mt-1 text-3xl font-semibold">Rapports hebdomadaires</h1>
			<p class="mt-1 text-ink-muted">
				Générez, révisez et publiez les rapports d’activité des membres de l’équipe.
			</p>
		</div>

		<!-- Week Navigation -->
		<div
			class="inline-flex items-center gap-1 self-start rounded-lg border border-line bg-surface p-1 text-sm shadow-xs sm:self-auto"
		>
			<a
				href={resolve('/(app)/rapports/hebdo/[semaine]', { semaine: data.prevWeek })}
				class="btn btn-ghost px-2.5 py-1.5"
				title="Semaine précédente"
			>
				<ArrowLeft class="size-4" aria-hidden="true" />
			</a>
			<span class="px-2 font-medium text-ink">
				{weekLabel}
			</span>
			<a
				href={resolve('/(app)/rapports/hebdo/[semaine]', { semaine: data.nextWeek })}
				class="btn btn-ghost px-2.5 py-1.5"
				title="Semaine suivante"
			>
				<ArrowRight class="size-4" aria-hidden="true" />
			</a>
		</div>
	</div>

	{#if form?.error}
		<Alert tone="danger">{form.error}</Alert>
	{/if}

	{#if form?.success}
		<Alert tone="success">
			{form.count} rapport(s) hebdomadaire(s) publié(s) avec succès pour l’équipe !
		</Alert>
	{/if}

	<!-- Overview Metrics Bar -->
	<div class="grid gap-4 sm:grid-cols-4">
		<div class="card p-4">
			<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Rapports publiés</p>
			<p class="mt-2 text-2xl font-bold text-ink">
				{data.overview.publishedCount} / {data.overview.totalMembers}
			</p>
			<p class="mt-1 text-xs text-ink-muted">
				{pendingCount > 0 ? `${pendingCount} restant(s)` : 'Tous publiés'}
			</p>
		</div>

		<div class="card p-4">
			<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">
				Progression moyenne
			</p>
			<p class="mt-2 text-2xl font-bold text-accent-ink">
				{data.overview.teamAverageProgressPct !== null
					? `${data.overview.teamAverageProgressPct} %`
					: '—'}
			</p>
			<p class="mt-1 text-xs text-ink-muted">Sur l'ensemble de l'équipe</p>
		</div>

		<div class="card p-4">
			<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Tâches réalisées</p>
			<p class="mt-2 text-2xl font-bold text-ink">
				{data.overview.totalDoneTasks} / {data.overview.totalTasks}
			</p>
			<p class="mt-1 text-xs text-ink-muted">Toutes catégories confondues</p>
		</div>

		<!-- Batch Publish Button -->
		<div class="card flex flex-col justify-between bg-surface-muted/40 p-4">
			<div>
				<p class="text-xs font-semibold tracking-wider text-ink-muted uppercase">Action groupée</p>
				<p class="mt-1 text-xs text-ink-muted">Publie tous les membres non encore publiés</p>
			</div>
			<form
				method="POST"
				action="?/batchPublish"
				onsubmit={() => {
					isBatchSubmitting = true;
				}}
				class="mt-3"
			>
				<button
					type="submit"
					disabled={pendingCount === 0 || isBatchSubmitting}
					class="btn btn-primary inline-flex w-full items-center justify-center gap-1.5 text-xs"
				>
					<CheckCheck class="size-3.5" aria-hidden="true" />
					Publier l'équipe ({pendingCount})
				</button>
			</form>
		</div>
	</div>

	<!-- Members Reports Table -->
	<div class="card overflow-hidden">
		<div class="flex items-center justify-between border-b border-line px-5 py-4">
			<h2 class="text-base font-semibold text-ink">Membres du département</h2>
			<span class="text-xs text-ink-muted">
				Semaine du {data.weekStart}
			</span>
		</div>

		<div class="divide-y divide-line">
			{#each data.overview.members as item (item.member.id)}
				<div
					class="flex flex-col gap-4 p-5 transition hover:bg-surface-muted/20 sm:flex-row sm:items-center sm:justify-between"
				>
					<!-- Member Info -->
					<div class="flex min-w-0 items-center gap-3 sm:w-1/3">
						<span
							class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-ink"
						>
							{initialsOf(item.member.fullName)}
						</span>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<p class="truncate font-medium text-ink">{item.member.fullName}</p>
								{#if item.member.isChef}
									<span class="badge text-[10px]">Chef</span>
								{/if}
							</div>
							<p class="text-xs text-ink-muted">@{item.member.username}</p>
						</div>
					</div>

					<!-- Progress & Tasks -->
					<div class="sm:w-1/4">
						<div class="mb-1 flex items-center justify-between text-xs">
							<span class="text-ink-muted">
								{item.doneTasksCount} / {item.tasksCount} tâche(s)
							</span>
							<span class="font-bold text-ink">
								{item.progression.progressPct !== null ? `${item.progression.progressPct} %` : '—'}
							</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
							<div
								class="h-full bg-accent transition-all duration-300"
								style="width: {item.progression.progressPct ?? 0}%"
							></div>
						</div>
					</div>

					<!-- Status Badge -->
					<div class="sm:w-1/6">
						{#if item.report?.status === 'published'}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
							>
								Publié (v{item.report.version})
							</span>
						{:else if item.report?.status === 'reopened'}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning"
							>
								Rouvert (v{item.report.version})
							</span>
						{:else}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted"
							>
								Non publié
							</span>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2 sm:justify-end">
						{#if item.report?.status === 'published'}
							<a
								href={resolve('/api/export/hebdo/[id]', { id: item.report.id })}
								download
								class="btn btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
								title="Télécharger Word (.docx)"
							>
								<Download class="size-3.5" aria-hidden="true" />
								Word
							</a>
							<a
								href={resolve('/(app)/rapports/hebdo/[semaine]/[memberId]', {
									semaine: data.weekStart,
									memberId: item.member.id
								})}
								class="btn btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
							>
								<Eye class="size-3.5" aria-hidden="true" />
								Consulter
							</a>
						{:else}
							<a
								href={resolve('/(app)/rapports/hebdo/[semaine]/[memberId]', {
									semaine: data.weekStart,
									memberId: item.member.id
								})}
								class="btn btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
							>
								<FileText class="size-3.5" aria-hidden="true" />
								Rédiger & Publier
							</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
