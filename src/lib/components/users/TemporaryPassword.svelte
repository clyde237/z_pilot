<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';

	interface Props {
		fullName: string;
		username: string;
		temporaryPassword: string;
	}

	let { fullName, username, temporaryPassword }: Props = $props();

	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(temporaryPassword);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<!-- EF-USR-01 / EF-USR-03: shown once, never stored in clear. -->
<section
	class="rounded-xl border border-accent/50 bg-accent-soft p-5 text-ink"
	aria-labelledby="temporary-password-title"
>
	<div class="flex items-center gap-2">
		<KeyRound class="size-5 text-accent-ink" aria-hidden="true" />
		<h2 id="temporary-password-title" class="text-lg font-semibold">Mot de passe temporaire</h2>
	</div>
	<p class="mt-2 text-sm">
		Transmettez-le à <strong>{fullName}</strong> (identifiant <strong>{username}</strong>). Il ne
		fonctionne qu’une fois : un nouveau mot de passe sera demandé à la première connexion.
	</p>
	<div class="mt-4 flex flex-wrap items-center gap-3">
		<code
			class="rounded-lg border border-line bg-surface px-4 py-2 font-mono text-lg tracking-wider text-ink select-all"
			>{temporaryPassword}</code
		>
		<button type="button" class="btn btn-secondary" onclick={copy}>
			{#if copied}<Check class="size-4" aria-hidden="true" /> Copié{:else}<Copy
					class="size-4"
					aria-hidden="true"
				/> Copier{/if}
		</button>
	</div>
	<p class="mt-3 text-sm font-medium text-warning">
		Notez-le maintenant : il ne sera plus affiché après avoir quitté cette page.
	</p>
</section>
