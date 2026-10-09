<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import Alert from '#lib/components/ui/Alert.svelte';
	import PasswordField from '#lib/components/ui/PasswordField.svelte';
	import { roleLabels } from '#lib/domain/roles.js';
	import { PASSWORD_MIN_LENGTH } from '#lib/domain/users.js';

	let { data } = $props();

	const { form, errors, message, enhance, submitting } = superForm(untrack(() => data.form));
</script>

<svelte:head><title>Mon profil · Z_Pilot</title></svelte:head>

<p class="eyebrow">Compte</p>
<h1 class="mt-2 text-4xl font-semibold">Mon profil</h1>

<div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
	<section class="card p-6" aria-labelledby="identity-title">
		<h2 id="identity-title" class="text-xl font-semibold">Identité</h2>
		<dl class="mt-4 space-y-4 text-sm">
			<div>
				<dt class="text-ink-muted">Nom complet</dt>
				<dd class="mt-0.5 font-medium">{data.user.fullName}</dd>
			</div>
			<div>
				<dt class="text-ink-muted">Nom d’utilisateur</dt>
				<dd class="mt-0.5 font-mono font-medium">{data.user.username}</dd>
			</div>
			<div>
				<dt class="text-ink-muted">Rôles</dt>
				<dd class="mt-0.5 font-medium">{roleLabels(data.user).join(', ')}</dd>
			</div>
		</dl>
		<p class="mt-5 text-xs text-ink-muted">
			Pour corriger votre nom ou votre identifiant, adressez-vous à un administrateur.
		</p>
	</section>

	<section class="card p-6" aria-labelledby="password-title">
		<h2 id="password-title" class="text-xl font-semibold">Changer le mot de passe</h2>
		{#if $message}<div class="mt-4"><Alert tone="success">{$message}</Alert></div>{/if}
		<form method="POST" use:enhance class="mt-5 max-w-md space-y-5" novalidate>
			<PasswordField
				label="Mot de passe actuel"
				name="currentPassword"
				autocomplete="current-password"
				bind:value={$form.currentPassword}
				errors={$errors.currentPassword}
			/>
			<PasswordField
				label="Nouveau mot de passe"
				name="newPassword"
				autocomplete="new-password"
				hint="Au moins {PASSWORD_MIN_LENGTH} caractères."
				bind:value={$form.newPassword}
				errors={$errors.newPassword}
			/>
			<PasswordField
				label="Confirmez le nouveau mot de passe"
				name="confirmPassword"
				autocomplete="new-password"
				bind:value={$form.confirmPassword}
				errors={$errors.confirmPassword}
			/>
			<button class="btn btn-primary" disabled={$submitting}>Changer le mot de passe</button>
		</form>
	</section>
</div>
