<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import Alert from '#lib/components/ui/Alert.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import defaultMark from '#lib/assets/brand/z-pilot-mark.webp';
	import { ISO_WEEKDAYS } from '#lib/schemas/settings.js';

	let { data } = $props();

	const { form, errors, message, enhance, submitting } = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);

	let removeLogoChecked = $state(false);

	function toggleDay(day: number) {
		const current = $form.workingDays;
		if (current.includes(day)) {
			if (current.length > 1) {
				$form.workingDays = current.filter((d) => d !== day);
			}
		} else {
			$form.workingDays = [...current, day].sort();
		}
	}
</script>

<svelte:head><title>Paramètres · Z_Pilot</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<p class="eyebrow">Administration</p>
		<h1 class="mt-2 text-4xl font-semibold">Paramètres de l’application</h1>
		<p class="mt-2 text-ink-muted">
			Personnalisez l’identité de l’établissement, les jours ouvrés et les règles de session.
		</p>
	</div>
</div>

{#if $message}
	<div class="mt-6">
		<Alert tone={$message.tone}>{$message.text}</Alert>
	</div>
{/if}

<form
	method="POST"
	action="?/save"
	use:enhance
	enctype="multipart/form-data"
	class="mt-8 space-y-8"
	novalidate
>
	<!-- Identité et Export Word -->
	<section class="card p-6 sm:p-8" aria-labelledby="branding-heading">
		<h2 id="branding-heading" class="text-xl font-semibold">Identité de l’établissement</h2>
		<p class="mt-1 text-sm text-ink-muted">
			Ces informations figurent dans les en-têtes de l’application et les rapports Word exportés
			(EF-EXP-04).
		</p>

		<div class="mt-6 grid gap-6 sm:grid-cols-2">
			<TextField
				label="Nom de l’organisation"
				name="organizationName"
				bind:value={$form.organizationName}
				errors={$errors.organizationName}
				hint="Ex: Hôtel Zingana"
				required
			/>

			<TextField
				label="Nom du département"
				name="departmentName"
				bind:value={$form.departmentName}
				errors={$errors.departmentName}
				hint="Facultatif (ex: Service Réception & Hébergement)"
			/>
		</div>

		<div class="mt-6 grid gap-6 sm:grid-cols-2">
			<div>
				<label class="field-label" for="primaryColor">Couleur principale</label>
				<div class="flex items-center gap-3">
					<input
						type="color"
						id="primaryColorPicker"
						class="size-11 cursor-pointer rounded-lg border border-line bg-surface p-1"
						bind:value={$form.primaryColor}
						aria-label="Choisir la couleur"
					/>
					<input
						id="primaryColor"
						name="primaryColor"
						type="text"
						class="input font-mono uppercase"
						bind:value={$form.primaryColor}
						aria-invalid={$errors.primaryColor ? 'true' : undefined}
					/>
				</div>
				{#if $errors.primaryColor}
					<p class="field-error">{$errors.primaryColor[0]}</p>
				{/if}
				<p class="field-hint">Utilisée pour les titres et habillages des documents générés.</p>
			</div>

			<!-- Gestion du Logo -->
			<div>
				<span class="field-label">Logo de l’établissement</span>
				<div class="flex items-center gap-4">
					<div
						class="flex size-16 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted p-2"
					>
						{#if data.settings.hasCustomLogo && !removeLogoChecked}
							<img
								src="/api/settings/logo?t={data.settings.updatedAt.getTime()}"
								alt="Logo actuel"
								class="max-h-full max-w-full object-contain"
							/>
						{:else}
							<img
								src={defaultMark}
								alt="Logo par défaut"
								class="max-h-full max-w-full object-contain"
							/>
						{/if}
					</div>

					<div class="min-w-0 flex-1 space-y-2">
						<input
							type="file"
							name="logo"
							accept="image/png,image/jpeg,image/webp,image/svg+xml"
							class="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-line"
							disabled={removeLogoChecked}
						/>
						<p class="text-xs text-ink-muted">PNG, JPEG, WebP ou SVG (max 2 Mo).</p>
					</div>
				</div>

				{#if data.settings.hasCustomLogo}
					<div class="mt-3 flex items-center gap-2">
						<input
							type="checkbox"
							id="removeLogo"
							name="removeLogo"
							value="true"
							class="checkbox"
							bind:checked={removeLogoChecked}
						/>
						<label for="removeLogo" class="text-sm text-ink-muted hover:text-ink">
							Revenir au logo par défaut
						</label>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Organisation du travail et Sessions -->
	<section class="card p-6 sm:p-8" aria-labelledby="work-heading">
		<h2 id="work-heading" class="text-xl font-semibold">Fonctionnement et Sécurité</h2>
		<p class="mt-1 text-sm text-ink-muted">
			Jours d’activité pris en compte pour les rappels automatiques et durée de validité des
			sessions.
		</p>

		<!-- Jours ouvrés -->
		<div class="mt-6">
			<span class="field-label">Jours ouvrés du département</span>
			<p class="mb-3 text-sm text-ink-muted">
				Définit les jours de la semaine pris en compte pour les tâches et alertes (RG-01).
			</p>

			<div class="flex flex-wrap gap-2">
				{#each ISO_WEEKDAYS as day (day.value)}
					{@const isSelected = $form.workingDays.includes(day.value)}
					<button
						type="button"
						onclick={() => toggleDay(day.value)}
						class={[
							'flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
							isSelected
								? 'border-brand bg-brand text-on-brand'
								: 'border-line bg-surface text-ink hover:bg-surface-muted'
						]}
					>
						<span>{day.label}</span>
					</button>
				{/each}
			</div>
			<!-- Hidden inputs to send workingDays array in formData -->
			{#each $form.workingDays as day (day)}
				<input type="hidden" name="workingDays" value={day} />
			{/each}
			{#if $errors.workingDays}
				<p class="field-error mt-2">{$errors.workingDays[0]}</p>
			{/if}
		</div>

		<!-- Durée des sessions -->
		<div class="mt-8 max-w-sm">
			<label class="field-label" for="sessionDurationDays">Durée de session (en jours)</label>
			<div class="relative">
				<input
					id="sessionDurationDays"
					name="sessionDurationDays"
					type="number"
					min="1"
					max="90"
					class="input pr-16 tabular-nums"
					bind:value={$form.sessionDurationDays}
					aria-invalid={$errors.sessionDurationDays ? 'true' : undefined}
				/>
				<span
					class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted"
				>
					jours
				</span>
			</div>
			{#if $errors.sessionDurationDays}
				<p class="field-error">{$errors.sessionDurationDays[0]}</p>
			{/if}
			<p class="field-hint">
				Définit l’expiration des cookies de session pour les utilisateurs inactifs (EF-AUT-02, 7
				jours par défaut).
			</p>
		</div>
	</section>

	<div class="flex justify-end">
		<button class="btn btn-primary min-w-44" disabled={$submitting}>
			{$submitting ? 'Enregistrement…' : 'Enregistrer les modifications'}
		</button>
	</div>
</form>
