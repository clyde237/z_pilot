<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Lock from '@lucide/svelte/icons/lock';
	import Alert from '#lib/components/ui/Alert.svelte';
	import { ISO_DAY_NAMES, TASK_WEIGHT_LABELS } from '#lib/domain/tasks.js';
	import { formatWeekLabel } from '#lib/format.js';

	let { data, form } = $props();

	const week = $derived(data.weekData);
	const prog = $derived(week.progression);
	const isLocked = $derived(week.isLocked);

	let savingDifficulties = $state(false);
</script>

<svelte:head>
	<title>{formatWeekLabel(data.weekStart)} · Mon espace · Z_Pilot</title>
</svelte:head>

<!-- En-tête et Sélecteur de semaine (EF-MEM-01, EF-MEM-05) -->
<div class="flex flex-wrap items-center justify-between gap-4">
	<div>
		<p class="eyebrow">Mon espace</p>
		<h1 class="mt-1 text-2xl font-semibold sm:text-3xl">
			{formatWeekLabel(data.weekStart)}
		</h1>
	</div>

	<!-- Navigation entre semaines -->
	<div class="flex items-center gap-2">
		<a
			href={resolve('/(app)/mon-espace/[semaine]', { semaine: data.prevWeek })}
			class="btn btn-secondary px-3 py-2 text-xs"
			title="Semaine précédente"
		>
			<ChevronLeft class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">Précédente</span>
		</a>

		{#if !data.isCurrentWeek}
			<a
				href={resolve('/(app)/mon-espace')}
				class="btn btn-secondary px-3 py-2 text-xs font-semibold text-accent-ink"
			>
				Semaine en cours
			</a>
		{/if}

		<a
			href={resolve('/(app)/mon-espace/[semaine]', { semaine: data.nextWeek })}
			class="btn btn-secondary px-3 py-2 text-xs"
			title="Semaine suivante"
		>
			<span class="hidden sm:inline">Suivante</span>
			<ChevronRight class="size-4" aria-hidden="true" />
		</a>
	</div>
</div>

{#if isLocked}
	<div class="mt-6">
		<Alert tone="danger">
			<div class="flex items-center gap-2 font-medium">
				<Lock class="size-4 shrink-0" aria-hidden="true" />
				<span>Cette semaine est clôturée et le rapport hebdomadaire est publié.</span>
			</div>
			<p class="mt-1 text-xs opacity-90">
				Vos tâches, notes et difficultés sont désormais figées en lecture seule (RG-06).
			</p>
		</Alert>
	</div>
{/if}

{#if form?.error}
	<div class="mt-4">
		<Alert tone="danger">{form.error}</Alert>
	</div>
{/if}

<!-- Jauge de progression de la semaine (RG-03, CDC §9) -->
<section class="card mt-6 p-6 sm:p-8" aria-labelledby="progress-title">
	<div class="flex items-baseline justify-between gap-4">
		<h2 id="progress-title" class="text-lg font-semibold sm:text-xl">Progression de la semaine</h2>
		{#if prog.progressPct !== null}
			<span class="font-serif text-3xl font-bold text-accent-ink tabular-nums sm:text-4xl">
				{prog.progressPct} %
			</span>
		{:else}
			<span class="rounded-full bg-surface-muted px-3 py-1 text-sm font-medium text-ink-muted">
				Aucun objectif défini
			</span>
		{/if}
	</div>

	{#if prog.progressPct !== null}
		<div class="mt-4 h-3.5 w-full overflow-hidden rounded-full bg-surface-muted p-0.5">
			<div
				class="h-full rounded-full bg-accent transition-all duration-300"
				style="width: {prog.progressPct}%"
			></div>
		</div>

		<div class="mt-3 flex items-center justify-between text-xs text-ink-muted">
			<span>
				{prog.completedTasksCount} sur {prog.totalTasksCount} tâche{prog.totalTasksCount > 1
					? 's'
					: ''} réalisée{prog.completedTasksCount > 1 ? 's' : ''}
			</span>
			<span class="tabular-nums">
				Poids réalisé : {prog.achievedWeight.toFixed(1)} / {prog.totalWeight}
			</span>
		</div>
	{/if}
</section>

<!-- Liste des tâches de la semaine (EF-MEM-01, EF-MEM-02, EF-MEM-03, EF-OBJ-05) -->
<section class="mt-8 space-y-4" aria-labelledby="tasks-title">
	<div class="flex items-center justify-between">
		<h2 id="tasks-title" class="text-xl font-semibold">Tâches assignées</h2>
		<span class="text-xs text-ink-muted">
			{week.tasks.length} tâche{week.tasks.length > 1 ? 's' : ''}
		</span>
	</div>

	{#if week.tasks.length === 0}
		<div class="card p-8 text-center text-ink-muted">
			<p class="font-medium text-ink">Aucune tâche assignée pour cette semaine.</p>
			<p class="mt-1 text-sm">
				Le chef de département n’a pas encore défini vos objectifs pour cette période.
			</p>
		</div>
	{:else}
		<ul class="space-y-4">
			{#each week.tasks as task (task.id)}
				{@const weightInfo = TASK_WEIGHT_LABELS[task.weight] ?? {
					label: `Poids ${task.weight}`,
					shortLabel: `Poids ${task.weight}`
				}}
				{@const isQuantitative = task.targetValue !== null && task.targetValue > 0}
				<li class="card p-5 transition-colors hover:border-line/80 sm:p-6">
					<!-- Formulaire de cochage & mise à jour (REC-10: mobile first, touch targets >= 44px) -->
					<form method="POST" action="?/updateTask" use:enhance class="space-y-4">
						<input type="hidden" name="taskId" value={task.id} />

						<div class="flex items-start gap-4">
							<!-- Case à cocher pour tâche qualitative -->
							{#if !isQuantitative}
								<label class="flex size-11 shrink-0 cursor-pointer items-center justify-center">
									<input
										type="checkbox"
										name="isDone"
										value="true"
										checked={task.isDone}
										disabled={isLocked}
										onchange={(e) => (e.currentTarget.form as HTMLFormElement)?.requestSubmit()}
										class="checkbox size-6"
									/>
									<span class="sr-only">Cocher comme réalisée</span>
								</label>
							{:else}
								<!-- Indicateur tâche quantitative -->
								<div
									class={[
										'flex size-11 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
										task.isDone
											? 'border-success/30 bg-success-soft text-success'
											: 'border-line bg-surface-muted text-ink-muted'
									]}
								>
									{#if task.isDone}
										<Check class="size-5" aria-hidden="true" />
									{:else}
										<span class="font-mono text-xs">{task.weight}x</span>
									{/if}
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<p
										class={[
											'text-base font-semibold sm:text-lg',
											task.isDone && 'text-ink-muted line-through decoration-line'
										]}
									>
										{task.title}
									</p>

									<div class="flex flex-wrap items-center gap-1.5 text-xs">
										<span
											class="rounded-full bg-surface-muted px-2.5 py-0.5 font-medium text-ink-muted"
										>
											{weightInfo.shortLabel}
										</span>

										{#if task.plannedDay}
											<span
												class="rounded-full bg-surface-muted px-2.5 py-0.5 font-medium text-ink-muted"
											>
												{ISO_DAY_NAMES[task.plannedDay] ?? `Jour ${task.plannedDay}`}
											</span>
										{/if}
									</div>
								</div>

								{#if task.description}
									<p class="mt-1 text-sm text-ink-muted">{task.description}</p>
								{/if}

								<!-- Tâche quantitative : champ de saisie de la valeur réalisée -->
								{#if isQuantitative}
									<div class="mt-4 flex flex-wrap items-center gap-3">
										<label class="text-sm font-medium" for="achieved-{task.id}"> Réalisé : </label>
										<div class="flex items-center gap-2">
											<input
												id="achieved-{task.id}"
												name="achievedValue"
												type="number"
												step="any"
												min="0"
												value={task.achievedValue ?? 0}
												disabled={isLocked}
												onblur={(e) => (e.currentTarget.form as HTMLFormElement)?.requestSubmit()}
												class="input h-10 w-24 text-center tabular-nums"
											/>
											<span class="text-sm text-ink-muted">
												/ {task.targetValue}
												{task.unit}
											</span>
										</div>
										<button
											type="submit"
											class="btn btn-secondary h-10 px-3 text-xs"
											disabled={isLocked}
										>
											Mettre à jour
										</button>
									</div>
								{/if}

								<!-- Note libre de fin de tâche (EF-MEM-03) -->
								<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
									<input
										type="text"
										name="note"
										value={task.note ?? ''}
										disabled={isLocked}
										placeholder="Ajouter une note ou préciser le résultat..."
										onblur={(e) => {
											if (e.currentTarget.value !== (task.note ?? '')) {
												(e.currentTarget.form as HTMLFormElement)?.requestSubmit();
											}
										}}
										class="input h-10 flex-1 text-sm placeholder:text-ink-muted/60"
									/>
									<button
										type="submit"
										class="btn btn-secondary h-10 px-3 text-xs whitespace-nowrap"
										disabled={isLocked}
									>
										Enregistrer note
									</button>
								</div>
							</div>
						</div>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<!-- Difficultés rencontrées cette semaine (EF-MEM-04) -->
<section class="card mt-8 p-6 sm:p-8" aria-labelledby="difficulties-heading">
	<h2 id="difficulties-heading" class="text-xl font-semibold">
		Difficultés rencontrées cette semaine
	</h2>
	<p class="mt-1 text-sm text-ink-muted">
		Signalez vos blocages, contraintes ou difficultés pour qu'ils soient repris dans le rapport
		hebdomadaire.
	</p>

	<form
		method="POST"
		action="?/saveDifficulties"
		use:enhance={() => {
			savingDifficulties = true;
			return async ({ update }) => {
				await update();
				savingDifficulties = false;
			};
		}}
		class="mt-4 space-y-4"
	>
		<textarea
			name="difficulties"
			rows="4"
			disabled={isLocked}
			value={data.weekData.difficulties}
			placeholder="Saisissez ici les blocages ou difficultés rencontrés au cours de la semaine..."
			class="input block w-full resize-y text-sm"></textarea>

		{#if !isLocked}
			<div class="flex items-center justify-between">
				{#if form?.savedDifficulties}
					<span class="text-xs font-medium text-success">
						✓ Difficultés enregistrées avec succès
					</span>
				{:else}
					<span></span>
				{/if}
				<button class="btn btn-primary" disabled={savingDifficulties}>
					{savingDifficulties ? 'Enregistrement…' : 'Enregistrer les difficultés'}
				</button>
			</div>
		{/if}
	</form>
</section>
