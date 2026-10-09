<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import PasswordField from '#lib/components/ui/PasswordField.svelte';
	import { PASSWORD_MIN_LENGTH } from '#lib/domain/users.js';

	let { data } = $props();

	const { form, errors, enhance, submitting } = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
</script>

<svelte:head><title>Nouveau mot de passe · Z_Pilot</title></svelte:head>

<section class="card border-t-4 border-t-accent p-6 sm:p-8" aria-labelledby="password-title">
	<p class="eyebrow">Première connexion</p>
	<h1 id="password-title" class="mt-2 text-3xl font-semibold">Choisissez votre mot de passe</h1>
	<p class="mt-2 text-sm text-ink-muted">
		Bienvenue, {data.fullName}. Le mot de passe temporaire ne fonctionnera plus : définissez le
		vôtre pour accéder à l’application.
	</p>

	<form method="POST" use:enhance class="mt-6 space-y-5" novalidate>
		<PasswordField
			label="Nouveau mot de passe"
			name="newPassword"
			autocomplete="new-password"
			hint="Au moins {PASSWORD_MIN_LENGTH} caractères. Une phrase courte est plus facile à retenir."
			bind:value={$form.newPassword}
			errors={$errors.newPassword}
		/>
		<PasswordField
			label="Confirmez le mot de passe"
			name="confirmPassword"
			autocomplete="new-password"
			bind:value={$form.confirmPassword}
			errors={$errors.confirmPassword}
		/>
		<button class="btn btn-primary w-full" disabled={$submitting}>Enregistrer et continuer</button>
	</form>

	<form method="POST" action="/logout" class="mt-4 text-center">
		<button
			class="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
		>
			Se déconnecter
		</button>
	</form>
</section>
