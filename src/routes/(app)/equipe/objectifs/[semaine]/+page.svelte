<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Copy from '@lucide/svelte/icons/copy';
	import Lock from '@lucide/svelte/icons/lock';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Unlock from '@lucide/svelte/icons/unlock';
	import X from '@lucide/svelte/icons/x';
	import Alert from '#lib/components/ui/Alert.svelte';
	import ConfirmAction from '#lib/components/ui/ConfirmAction.svelte';
	import { ISO_DAY_NAMES, TASK_WEIGHT_LABELS } from '#lib/domain/tasks.js';
	import { formatWeekLabel } from '#lib/format.js';
	import type { TaskItem } from '#lib/server/tasks.js';

	let { data, form } = $props();

	const dept = $derived(data.deptData);

	let createModal: HTMLDialogElement;
	let editModal: HTMLDialogElement;
	let reopenModal: HTMLDialogElement;

	let editingTask = $state<TaskItem | null>(null);
	let reopenTarget = $state<{ memberId: string; memberName: string } | null>(null);
	let reopenReason = $state('');
	let isReopening = $state(false);

	function openReopenModal(memberId: string, memberName: string) {
		reopenTarget = { memberId, memberName };
		reopenReason = '';
		reopenModal.showModal();
	}

	// Create task form state
	let selectedMemberIds = $state<string[]>([]);
	let isQuantitativeCreate = $state(false);

	// Edit task form state
	let isQuantitativeEdit = $state(false);

	function openCreateModal(defaultMemberId?: string) {
		selectedMemberIds = defaultMemberId ? [defaultMemberId] : [];
		isQuantitativeCreate = false;
		createModal.showModal();
	}

	function openEditModal(task: TaskItem) {
		editingTask = task;
		isQuantitativeEdit = task.targetValue !== null && task.targetValue > 0;
		editModal.showModal();
	}

	function toggleSelectAllMembers() {
		if (selectedMemberIds.length === data.activeMembers.length) {
			selectedMemberIds = [];
		} else {
			selectedMemberIds = data.activeMembers.map((m) => m.id);
		}
	}
</script>

<svelte:head>
	<title>{formatWeekLabel(data.weekStart)} · Objectifs de l’équipe · Z_Pilot</title>
</svelte:head>

<!-- En-tête et Navigation semaine -->
<div class="flex flex-wrap items-center justify-between gap-4">
	<div>
		<p class="eyebrow">Chef de département</p>
		<h1 class="mt-1 text-2xl font-semibold sm:text-3xl">Objectifs de la semaine</h1>
		<p class="text-sm text-ink-muted">{formatWeekLabel(data.weekStart)}</p>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<button type="button" class="btn btn-primary" onclick={() => openCreateModal()}>
			<Plus class="size-4" aria-hidden="true" />
			<span>Nouvelle tâche</span>
		</button>

		<div class="flex items-center gap-1">
			<a
				href={resolve('/(app)/equipe/objectifs/[semaine]', { semaine: data.prevWeek })}
				class="btn btn-secondary px-3 py-2 text-xs"
				title="Semaine précédente"
			>
				<ChevronLeft class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">Précédente</span>
			</a>

			{#if !data.isCurrentWeek}
				<a
					href={resolve('/(app)/equipe/objectifs')}
					class="btn btn-secondary px-3 py-2 text-xs font-semibold text-accent-ink"
				>
					Semaine courante
				</a>
			{/if}

			<a
				href={resolve('/(app)/equipe/objectifs/[semaine]', { semaine: data.nextWeek })}
				class="btn btn-secondary px-3 py-2 text-xs"
				title="Semaine suivante"
			>
				<span class="hidden sm:inline">Suivante</span>
				<ChevronRight class="size-4" aria-hidden="true" />
			</a>
		</div>
	</div>
</div>

<!-- Notifications de retour d'actions -->
{#if form?.successMessage}
	<div class="mt-6"><Alert tone="success">{form.successMessage}</Alert></div>
{/if}
{#if form?.createError || form?.editError || form?.actionError}
	<div class="mt-6">
		<Alert tone="danger">{form.createError ?? form.editError ?? form.actionError}</Alert>
	</div>
{/if}

<!-- Indicateur global de l'équipe (EF-DAS-05) -->
<section class="card mt-6 p-6 sm:p-8" aria-labelledby="team-progress-title">
	<div class="flex items-baseline justify-between gap-4">
		<div>
			<h2 id="team-progress-title" class="text-lg font-semibold sm:text-xl">
				Progression globale de l’équipe
			</h2>
			<p class="text-xs text-ink-muted sm:text-sm">
				Moyenne des membres ayant des objectifs assignés (EF-DAS-05).
			</p>
		</div>
		{#if dept.teamAverageProgressPct !== null}
			<span class="font-serif text-3xl font-bold text-accent-ink tabular-nums sm:text-4xl">
				{dept.teamAverageProgressPct} %
			</span>
		{:else}
			<span class="rounded-full bg-surface-muted px-3 py-1 text-sm font-medium text-ink-muted">
				Aucun objectif défini
			</span>
		{/if}
	</div>

	{#if dept.teamAverageProgressPct !== null}
		<div class="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-muted p-0.5">
			<div
				class="h-full rounded-full bg-accent transition-all duration-300"
				style="width: {dept.teamAverageProgressPct}%"
			></div>
		</div>
	{/if}
</section>

<!-- Vue par membre de l'équipe (EF-DAS-01, EF-OBJ-01, EF-OBJ-02) -->
<div class="mt-8 space-y-6">
	{#each dept.members as m (m.member.id)}
		<article class="card overflow-hidden">
			<!-- En-tête du membre -->
			<div
				class="border-b border-line bg-surface-muted/30 p-4 sm:flex sm:items-center sm:justify-between sm:p-6"
			>
				<div class="flex items-center gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<h3 class="text-lg font-semibold text-ink">{m.member.fullName}</h3>
							{#if m.member.isChef}
								<span
									class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink"
								>
									Chef
								</span>
							{/if}
							{#if m.isLocked}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning"
								>
									<Lock class="size-3" aria-hidden="true" /> Rapport publié
								</span>
							{/if}
						</div>
						<p class="font-mono text-xs text-ink-muted">{m.member.username}</p>
					</div>
				</div>

				<div class="mt-4 flex flex-wrap items-center gap-3 sm:mt-0">
					<!-- Progression du membre -->
					{#if m.progression.progressPct !== null}
						<div class="flex items-center gap-2">
							<div class="h-2 w-20 overflow-hidden rounded-full bg-surface-muted">
								<div class="h-full bg-accent" style="width: {m.progression.progressPct}%"></div>
							</div>
							<span class="text-sm font-semibold text-accent-ink tabular-nums">
								{m.progression.progressPct} %
							</span>
						</div>
					{:else}
						<span class="text-xs text-ink-muted">Aucun objectif</span>
					{/if}

					<!-- Boutons d'actions rapides par membre -->
					{#if !m.isLocked}
						<button
							type="button"
							class="btn btn-secondary px-2.5 py-1.5 text-xs"
							onclick={() => openCreateModal(m.member.id)}
							title="Ajouter une tâche pour ce membre"
						>
							<Plus class="size-3.5" aria-hidden="true" />
							<span>Tâche</span>
						</button>

						{#if m.tasks.length > 0}
							<form method="POST" action="?/duplicate" use:enhance>
								<input type="hidden" name="memberId" value={m.member.id} />
								<button
									class="btn btn-secondary px-2.5 py-1.5 text-xs"
									title="Dupliquer ces tâches vers la semaine suivante (EF-OBJ-06)"
								>
									<Copy class="size-3.5" aria-hidden="true" />
									<span class="hidden sm:inline">Dupliquer</span>
								</button>
							</form>
						{/if}
					{:else}
						<button
							type="button"
							class="btn btn-secondary inline-flex items-center gap-1.5 border-warning/40 px-2.5 py-1.5 text-xs font-semibold text-warning hover:bg-warning-soft"
							onclick={() => openReopenModal(m.member.id, m.member.fullName)}
							title="Rouvrir cette semaine pour ce membre (RG-06)"
						>
							<Unlock class="size-3.5" aria-hidden="true" />
							<span>Rouvrir la semaine</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Liste des tâches du membre -->
			{#if m.tasks.length === 0}
				<div class="p-6 text-center text-sm text-ink-muted">
					Aucune tâche assignée à ce membre pour cette semaine.
				</div>
			{:else}
				<ul class="divide-y divide-line">
					{#each m.tasks as task (task.id)}
						{@const isQuant = task.targetValue !== null && task.targetValue > 0}
						<li
							class="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-surface-muted/20 sm:p-5"
						>
							<div class="flex min-w-0 flex-1 items-start gap-3">
								<!-- Statut coché / non coché -->
								<div
									class={[
										'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
										task.isDone
											? 'bg-success-soft text-success'
											: 'border border-line bg-surface text-ink-muted'
									]}
								>
									{#if task.isDone}
										<Check class="size-3.5" aria-hidden="true" />
									{/if}
								</div>

								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<p class={['font-medium', task.isDone && 'text-ink-muted line-through']}>
											{task.title}
										</p>

										<span
											class="rounded bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted"
										>
											{TASK_WEIGHT_LABELS[task.weight]?.shortLabel ?? `Poids ${task.weight}`}
										</span>

										{#if task.plannedDay}
											<span class="rounded bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
												{ISO_DAY_NAMES[task.plannedDay]}
											</span>
										{/if}

										{#if task.carriedFromTaskId}
											<span
												class="rounded bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink"
											>
												Reportée
											</span>
										{/if}
									</div>

									{#if task.description}
										<p class="mt-0.5 text-xs text-ink-muted">{task.description}</p>
									{/if}

									{#if isQuant}
										<p class="mt-1 text-xs font-semibold text-accent-ink">
											{task.achievedValue ?? 0} / {task.targetValue}
											{task.unit}
										</p>
									{/if}

									{#if task.note}
										<p class="mt-1 text-xs text-ink-muted italic">
											Note : {task.note}
										</p>
									{/if}
								</div>
							</div>

							<!-- Actions du chef sur la tâche (EF-OBJ-02, EF-OBJ-07) -->
							{#if !m.isLocked}
								<div class="flex items-center gap-1">
									<button
										type="button"
										class="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
										title="Modifier la tâche"
										onclick={() => openEditModal(task)}
									>
										<Pencil class="size-4" aria-hidden="true" />
										<span class="sr-only">Modifier</span>
									</button>

									{#if !task.isDone}
										<!-- Reporter la tâche non réalisée à la semaine suivante (EF-OBJ-07) -->
										<form method="POST" action="?/carry" use:enhance>
											<input type="hidden" name="taskId" value={task.id} />
											<input type="hidden" name="targetWeekStart" value={data.nextWeek} />
											<button
												class="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-accent-ink"
												title="Reporter à la semaine suivante (EF-OBJ-07)"
											>
												<ArrowRight class="size-4" aria-hidden="true" />
												<span class="sr-only">Reporter à la semaine suivante</span>
											</button>
										</form>
									{/if}

									<ConfirmAction
										action="?/delete"
										triggerLabel="Supprimer"
										title="Supprimer cette tâche ?"
										description={task.isDone
											? 'Attention : cette tâche a déjà été cochée par le membre. Sa suppression modifiera le calcul de la progression.'
											: 'La tâche sera définitivement retirée des objectifs du membre pour cette semaine.'}
										confirmLabel="Confirmer la suppression"
										tone="danger"
									/>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<!-- Difficultés déclarées par le membre -->
			{#if m.difficulties}
				<div class="border-t border-line bg-surface-muted/20 px-6 py-3 text-xs">
					<span class="font-semibold text-ink">Difficultés signalées :</span>
					<span class="text-ink-muted">{m.difficulties}</span>
				</div>
			{/if}
		</article>
	{/each}
</div>

<!-- Modal Création de tâche (EF-OBJ-01, EF-OBJ-04, EF-OBJ-05) -->
<dialog
	bind:this={createModal}
	class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-navy-950/60"
	aria-labelledby="create-modal-title"
>
	<form
		method="POST"
		action="?/create"
		class="p-6 sm:p-8"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				createModal.close();
			};
		}}
	>
		<h2 id="create-modal-title" class="text-xl font-semibold">Créer une tâche</h2>
		<p class="mt-1 text-sm text-ink-muted">
			Pour la semaine {formatWeekLabel(data.weekStart)}
		</p>

		<div class="mt-6 space-y-5">
			<div>
				<label class="field-label" for="task-title">Titre de la tâche</label>
				<input
					id="task-title"
					name="title"
					type="text"
					required
					class="input"
					placeholder="Ex: Nettoyage des filtres de climatisation"
				/>
			</div>

			<div>
				<label class="field-label" for="task-desc">Description (facultative)</label>
				<textarea
					id="task-desc"
					name="description"
					rows="2"
					class="input"
					placeholder="Précisions utiles pour le membre..."></textarea>
			</div>

			<!-- Assignation à un ou plusieurs membres (EF-OBJ-04) -->
			<div>
				<div class="flex items-center justify-between">
					<span class="field-label">Assigner à</span>
					<button
						type="button"
						class="text-xs text-accent-ink hover:underline"
						onclick={toggleSelectAllMembers}
					>
						{selectedMemberIds.length === data.activeMembers.length
							? 'Désélectionner tout'
							: 'Tous les membres'}
					</button>
				</div>
				<div class="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
					{#each data.activeMembers as m (m.id)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-muted"
						>
							<input
								type="checkbox"
								name="memberIds"
								value={m.id}
								class="checkbox"
								checked={selectedMemberIds.includes(m.id)}
								onchange={(e) => {
									if (e.currentTarget.checked) {
										selectedMemberIds = [...selectedMemberIds, m.id];
									} else {
										selectedMemberIds = selectedMemberIds.filter((id) => id !== m.id);
									}
								}}
							/>
							<span class="font-medium text-ink">{m.fullName}</span>
							{#if m.isChef}
								<span class="text-xs text-accent-ink">(Moi-même)</span>
							{/if}
						</label>
					{/each}
				</div>
			</div>

			<!-- Poids et Jour prévu -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="field-label" for="task-weight">Poids de la tâche</label>
					<select id="task-weight" name="weight" class="input">
						<option value="1">1 (Léger)</option>
						<option value="2">2 (Normal)</option>
						<option value="3">3 (Important)</option>
					</select>
				</div>

				<div>
					<label class="field-label" for="task-day">Jour prévu (optionnel)</label>
					<select id="task-day" name="plannedDay" class="input">
						<option value="">Indifférent</option>
						<option value="1">Lundi</option>
						<option value="2">Mardi</option>
						<option value="3">Mercredi</option>
						<option value="4">Jeudi</option>
						<option value="5">Vendredi</option>
						<option value="6">Samedi</option>
						<option value="7">Dimanche</option>
					</select>
				</div>
			</div>

			<!-- Tâche quantitative (EF-OBJ-05) -->
			<div class="space-y-3 rounded-lg border border-line p-4">
				<label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
					<input
						type="checkbox"
						name="isQuantitative"
						value="true"
						class="checkbox"
						bind:checked={isQuantitativeCreate}
					/>
					<span>Tâche quantitative (objectif chiffré)</span>
				</label>

				{#if isQuantitativeCreate}
					<div class="grid grid-cols-2 gap-3 pt-2">
						<div>
							<label class="field-label text-xs" for="target-val">Cible chiffrée</label>
							<input
								id="target-val"
								name="targetValue"
								type="number"
								min="1"
								step="any"
								required
								class="input"
								placeholder="Ex: 20"
							/>
						</div>
						<div>
							<label class="field-label text-xs" for="target-unit">Unité</label>
							<input
								id="target-unit"
								name="unit"
								type="text"
								required
								class="input"
								placeholder="Ex: tickets, fiches"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-8 flex justify-end gap-3">
			<button type="button" class="btn btn-secondary" onclick={() => createModal.close()}>
				Annuler
			</button>
			<button class="btn btn-primary" disabled={selectedMemberIds.length === 0}>
				Créer la tâche
			</button>
		</div>
	</form>
</dialog>

<!-- Modal Modification de tâche (EF-OBJ-02) -->
<dialog
	bind:this={editModal}
	class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-navy-950/60"
	aria-labelledby="edit-modal-title"
>
	{#if editingTask}
		<form
			method="POST"
			action="?/edit"
			class="p-6 sm:p-8"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					editModal.close();
				};
			}}
		>
			<input type="hidden" name="taskId" value={editingTask.id} />

			<h2 id="edit-modal-title" class="text-xl font-semibold">Modifier la tâche</h2>

			{#if editingTask.isDone}
				<div class="mt-4">
					<Alert tone="warning">
						Attention : cette tâche a déjà été marquée comme réalisée par le membre. Toute
						modification impactera la progression.
					</Alert>
				</div>
			{/if}

			<div class="mt-6 space-y-5">
				<div>
					<label class="field-label" for="edit-title">Titre de la tâche</label>
					<input
						id="edit-title"
						name="title"
						type="text"
						required
						class="input"
						value={editingTask.title}
					/>
				</div>

				<div>
					<label class="field-label" for="edit-desc">Description (facultative)</label>
					<textarea
						id="edit-desc"
						name="description"
						rows="2"
						class="input"
						value={editingTask.description ?? ''}></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="field-label" for="edit-weight">Poids</label>
						<select id="edit-weight" name="weight" class="input" value={editingTask.weight}>
							<option value="1">1 (Léger)</option>
							<option value="2">2 (Normal)</option>
							<option value="3">3 (Important)</option>
						</select>
					</div>

					<div>
						<label class="field-label" for="edit-day">Jour prévu</label>
						<select
							id="edit-day"
							name="plannedDay"
							class="input"
							value={editingTask.plannedDay ?? ''}
						>
							<option value="">Indifférent</option>
							<option value="1">Lundi</option>
							<option value="2">Mardi</option>
							<option value="3">Mercredi</option>
							<option value="4">Jeudi</option>
							<option value="5">Vendredi</option>
							<option value="6">Samedi</option>
							<option value="7">Dimanche</option>
						</select>
					</div>
				</div>

				<!-- Tâche quantitative -->
				<div class="space-y-3 rounded-lg border border-line p-4">
					<label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
						<input
							type="checkbox"
							name="isQuantitative"
							value="true"
							class="checkbox"
							bind:checked={isQuantitativeEdit}
						/>
						<span>Tâche quantitative (objectif chiffré)</span>
					</label>

					{#if isQuantitativeEdit}
						<div class="grid grid-cols-2 gap-3 pt-2">
							<div>
								<label class="field-label text-xs" for="edit-target-val">Cible chiffrée</label>
								<input
									id="edit-target-val"
									name="targetValue"
									type="number"
									min="1"
									step="any"
									required
									class="input"
									value={editingTask.targetValue ?? ''}
								/>
							</div>
							<div>
								<label class="field-label text-xs" for="edit-target-unit">Unité</label>
								<input
									id="edit-target-unit"
									name="unit"
									type="text"
									required
									class="input"
									value={editingTask.unit ?? ''}
								/>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="mt-8 flex justify-end gap-3">
				<button type="button" class="btn btn-secondary" onclick={() => editModal.close()}>
					Annuler
				</button>
				<button class="btn btn-primary">Enregistrer les modifications</button>
			</div>
		</form>
	{/if}
</dialog>

<dialog
	bind:this={reopenModal}
	class="modal-backdrop w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl backdrop:bg-black/60 sm:p-8"
>
	{#if reopenTarget}
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning"
				>
					<Unlock class="size-5" aria-hidden="true" />
				</div>
				<div>
					<h3 class="text-lg font-semibold text-ink">Rouvrir la semaine clôturée</h3>
					<p class="text-xs text-ink-muted">
						Membre : <span class="font-medium text-ink">{reopenTarget.memberName}</span> · Règle RG-06
					</p>
				</div>
			</div>
			<button
				type="button"
				class="rounded-lg p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
				onclick={() => reopenModal.close()}
				aria-label="Fermer"
			>
				<X class="size-5" aria-hidden="true" />
			</button>
		</div>

		<p class="mt-4 text-sm leading-relaxed text-ink-muted">
			En rouvrant la semaine de ce membre, son rapport hebdomadaire repassera au statut
			<span class="font-medium text-ink">« rouvert »</span>. Ses objectifs et difficultés seront de
			nouveau modifiables pour effectuer des corrections.
		</p>

		<form
			method="POST"
			action="?/reopenMemberWeek"
			use:enhance={() => {
				isReopening = true;
				return async ({ update }) => {
					isReopening = false;
					reopenModal.close();
					await update();
				};
			}}
			class="mt-5 space-y-4"
		>
			<input type="hidden" name="memberId" value={reopenTarget.memberId} />

			<div>
				<label for="memberReopenReason" class="label text-xs font-semibold">
					Motif de réouverture <span class="text-danger">*</span>
				</label>
				<textarea
					id="memberReopenReason"
					name="reopenedReason"
					rows="3"
					required
					minlength="3"
					maxlength="500"
					bind:value={reopenReason}
					placeholder="Ex. : Modification des objectifs, rectification des résultats..."
					class="textarea mt-1 w-full text-sm"></textarea>
				<p class="mt-1 text-xs text-ink-muted">
					Au moins 3 caractères. Ce motif sera consigné dans le journal d'audit et notifié au
					membre.
				</p>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					class="btn btn-secondary px-4 py-2 text-sm"
					onclick={() => reopenModal.close()}
					disabled={isReopening}
				>
					Annuler
				</button>
				<button
					type="submit"
					class="btn btn-primary px-4 py-2 text-sm"
					disabled={isReopening || reopenReason.trim().length < 3}
				>
					{isReopening ? 'Réouverture...' : 'Confirmer la réouverture'}
				</button>
			</div>
		</form>
	{/if}
</dialog>
