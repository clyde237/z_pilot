<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Alert from '#lib/components/ui/Alert.svelte';
	import ConfirmAction from '#lib/components/ui/ConfirmAction.svelte';
	import TemporaryPassword from '#lib/components/users/TemporaryPassword.svelte';
	import UserForm from '#lib/components/users/UserForm.svelte';
	import { formatDate, formatTime } from '#lib/format.js';

	let { data, form: actionData } = $props();

	const account = $derived(data.account);
	const locked = $derived(account.lockedUntil !== null && account.lockedUntil > new Date());
</script>

<svelte:head><title>{account.fullName} · Z_Pilot</title></svelte:head>

<a
	href={resolve('/(app)/admin/utilisateurs')}
	class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
>
	<ArrowLeft class="size-4" aria-hidden="true" /> Utilisateurs
</a>
<p class="eyebrow mt-2">Administration</p>
<div class="mt-2 flex flex-wrap items-center gap-3">
	<h1 class="text-4xl font-semibold">{account.fullName}</h1>
	<span
		class={[
			'rounded-full px-2.5 py-1 text-xs font-medium',
			account.active ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
		]}>{account.active ? 'Actif' : 'Désactivé'}</span
	>
</div>
<p class="mt-1 text-sm text-ink-muted">Compte créé le {formatDate(account.createdAt)}</p>

<div class="mt-8 grid max-w-5xl gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
	<section class="card p-6" aria-labelledby="account-title">
		<h2 id="account-title" class="mb-5 text-xl font-semibold">Informations et rôles</h2>
		{#key account.id}
			<UserForm initial={data.form} submitLabel="Enregistrer" resetOnSuccess={false} />
		{/key}
	</section>

	<section class="card space-y-5 p-6" aria-labelledby="access-title">
		<h2 id="access-title" class="text-xl font-semibold">Accès</h2>

		{#if actionData?.accountError}<Alert tone="danger">{actionData.accountError}</Alert>{/if}
		{#if actionData?.notice}<Alert tone="success">{actionData.notice}</Alert>{/if}

		<dl class="space-y-3 text-sm">
			<div>
				<dt class="text-ink-muted">Mot de passe</dt>
				<dd class="font-medium">
					{account.mustChangePassword
						? 'Temporaire, à changer à la connexion'
						: 'Défini par l’utilisateur'}
				</dd>
			</div>
			{#if locked}
				<div>
					<dt class="text-ink-muted">Connexion</dt>
					<dd class="font-medium text-warning">
						Bloquée jusqu’à {formatTime(account.lockedUntil!)} après 5 échecs
					</dd>
				</div>
			{/if}
		</dl>

		{#if data.isSelf}
			<p class="text-sm text-ink-muted">
				C’est votre compte : changez votre mot de passe depuis
				<a class="font-medium text-ink underline underline-offset-4" href={resolve('/(app)/profil')}
					>Mon profil</a
				>. Un administrateur ne peut pas se désactiver lui-même.
			</p>
		{:else}
			<div class="flex flex-col gap-3">
				<ConfirmAction
					action="?/resetPassword"
					triggerLabel="Réinitialiser le mot de passe"
					title="Réinitialiser le mot de passe ?"
					description="Un mot de passe temporaire sera généré et affiché une seule fois. {account.fullName} sera déconnecté et devra en choisir un nouveau à la prochaine connexion. Un éventuel blocage sera levé."
					confirmLabel="Réinitialiser"
				/>
				{#if account.active}
					<ConfirmAction
						action="?/deactivate"
						tone="danger"
						triggerLabel="Désactiver le compte"
						title="Désactiver ce compte ?"
						description="{account.fullName} sera déconnecté et ne pourra plus se connecter. Son historique reste dans les rapports. Vous pourrez réactiver le compte plus tard."
						confirmLabel="Désactiver"
					/>
				{:else}
					<ConfirmAction
						action="?/reactivate"
						triggerLabel="Réactiver le compte"
						title="Réactiver ce compte ?"
						description="{account.fullName} pourra de nouveau se connecter avec son mot de passe actuel."
						confirmLabel="Réactiver"
					/>
				{/if}
			</div>
		{/if}
	</section>

	{#if actionData?.temporaryPassword}
		<div class="xl:col-span-2">
			<TemporaryPassword
				fullName={account.fullName}
				username={account.username}
				temporaryPassword={actionData.temporaryPassword}
			/>
		</div>
	{/if}
</div>
