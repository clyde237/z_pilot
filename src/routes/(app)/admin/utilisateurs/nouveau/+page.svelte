<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TemporaryPassword from '#lib/components/users/TemporaryPassword.svelte';
	import UserForm from '#lib/components/users/UserForm.svelte';

	let { data, form: actionData } = $props();
</script>

<svelte:head><title>Nouvel utilisateur · Z_Pilot</title></svelte:head>

<a
	href={resolve('/(app)/admin/utilisateurs')}
	class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
>
	<ArrowLeft class="size-4" aria-hidden="true" /> Utilisateurs
</a>
<p class="eyebrow mt-2">Administration</p>
<h1 class="mt-2 text-4xl font-semibold">Nouvel utilisateur</h1>

<div class="mt-8 max-w-3xl space-y-6">
	{#if actionData?.created}
		<TemporaryPassword {...actionData.created} />
		<p class="text-sm">
			<a
				class="font-medium underline underline-offset-4"
				href={resolve('/(app)/admin/utilisateurs/[id]', { id: actionData.created.userId })}
			>
				Voir le compte de {actionData.created.fullName}
			</a>
			· ou créez un autre compte ci-dessous.
		</p>
	{/if}

	<section class="card p-6" aria-label="Informations du compte">
		<UserForm initial={data.form} submitLabel="Créer le compte" resetOnSuccess={true} />
	</section>
</div>
