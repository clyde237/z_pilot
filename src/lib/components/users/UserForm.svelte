<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import Alert from '#lib/components/ui/Alert.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { USERNAME_RULE } from '#lib/domain/users.js';
	import type { UserFormInput } from '#lib/schemas/users.js';

	export interface UserFormMessage {
		tone: 'success' | 'danger';
		text: string;
	}

	interface Props {
		/** Initial values. Wrap the component in `{#key}` to load another account. */
		initial: SuperValidated<UserFormInput, UserFormMessage>;
		submitLabel: string;
		/** Empty the fields after a successful submit (creation of several accounts). */
		resetOnSuccess: boolean;
	}

	let { initial, submitLabel, resetOnSuccess }: Props = $props();

	const { form, errors, message, enhance, submitting } = superForm(
		untrack(() => initial),
		{ resetForm: untrack(() => resetOnSuccess) }
	);

	// The head always takes part in reports; only an admin may stay out (EF-USR-06).
	const participationForced = $derived($form.isChef || !$form.isAdmin);
	$effect(() => {
		if (participationForced) $form.participatesInReports = true;
	});
</script>

{#if $message}
	<div class="mb-5"><Alert tone={$message.tone}>{$message.text}</Alert></div>
{/if}

<!-- Container query: the form sits in cards of very different widths. -->
<form method="POST" action="?/save" use:enhance class="@container space-y-6" novalidate>
	<div class="grid gap-5 @lg:grid-cols-2">
		<TextField
			label="Nom complet"
			name="fullName"
			autocomplete="off"
			bind:value={$form.fullName}
			errors={$errors.fullName}
		/>
		<TextField
			label="Nom d’utilisateur"
			name="username"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			hint={USERNAME_RULE}
			bind:value={$form.username}
			errors={$errors.username}
		/>
	</div>

	<fieldset class="space-y-3">
		<legend class="field-label">Rôles</legend>
		<label class="flex min-h-11 items-start gap-3">
			<input type="checkbox" name="isAdmin" class="checkbox mt-0.5" bind:checked={$form.isAdmin} />
			<span>
				<span class="font-medium">Administrateur</span>
				<span class="block text-sm text-ink-muted">Gère les comptes et les paramètres.</span>
			</span>
		</label>
		{#if $errors.isAdmin}<p class="field-error">{$errors.isAdmin[0]}</p>{/if}

		<label class="flex min-h-11 items-start gap-3">
			<input type="checkbox" name="isChef" class="checkbox mt-0.5" bind:checked={$form.isChef} />
			<span>
				<span class="font-medium">Chef de département</span>
				<span class="block text-sm text-ink-muted">
					Assigne les tâches et publie les rapports. Un seul chef actif.
				</span>
			</span>
		</label>
		{#if $errors.isChef}<p class="field-error">{$errors.isChef[0]}</p>{/if}

		<label class="flex min-h-11 items-start gap-3">
			{#if participationForced}
				<!-- A disabled checkbox is not submitted: the hidden field carries the value. -->
				<input type="hidden" name="participatesInReports" value="on" />
				<input type="checkbox" class="checkbox mt-0.5" checked disabled />
			{:else}
				<input
					type="checkbox"
					name="participatesInReports"
					class="checkbox mt-0.5"
					bind:checked={$form.participatesInReports}
				/>
			{/if}
			<span>
				<span class="font-medium">Participe aux tâches et aux rapports</span>
				<span class="block text-sm text-ink-muted">
					{participationForced
						? 'Toujours le cas pour un membre ou le chef.'
						: 'Décochez pour un administrateur purement technique.'}
				</span>
			</span>
		</label>
		{#if $errors.participatesInReports}
			<p class="field-error">{$errors.participatesInReports[0]}</p>
		{/if}
	</fieldset>

	<button class="btn btn-primary w-full sm:w-auto" disabled={$submitting}>{submitLabel}</button>
</form>
