<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import Alert from '#lib/components/ui/Alert.svelte';
	import PasswordField from '#lib/components/ui/PasswordField.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let { data } = $props();

	const { form, errors, message, enhance, submitting } = superForm(
		untrack(() => data.form),
		{
			resetForm: false
		}
	);
</script>

<svelte:head><title>Connexion · Z_Pilot</title></svelte:head>

<section class="card border-t-4 border-t-accent p-6 sm:p-8" aria-labelledby="login-title">
	<p class="eyebrow">Suivi des tâches et rapports d’activité</p>
	<h1 id="login-title" class="mt-2 text-3xl font-semibold">Connexion</h1>
	<p class="mt-1 text-sm text-ink-muted">Utilisez les identifiants fournis par l’administrateur.</p>

	{#if $message}
		<div class="mt-5"><Alert tone="danger">{$message}</Alert></div>
	{/if}

	<form method="POST" use:enhance class="mt-6 space-y-5" novalidate>
		<TextField
			label="Nom d’utilisateur"
			name="username"
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			bind:value={$form.username}
			errors={$errors.username}
		/>
		<PasswordField
			label="Mot de passe"
			name="password"
			autocomplete="current-password"
			bind:value={$form.password}
			errors={$errors.password}
		/>
		<button class="btn btn-primary w-full" disabled={$submitting}>
			{$submitting ? 'Connexion…' : 'Se connecter'}
		</button>
	</form>
</section>
