<script lang="ts">
	import { enhance } from '$app/forms';

	interface Props {
		/** Form action, e.g. `?/deactivate`. */
		action: string;
		triggerLabel: string;
		title: string;
		description: string;
		confirmLabel: string;
		tone?: 'danger' | 'neutral';
	}

	let {
		action,
		triggerLabel,
		title,
		description,
		confirmLabel,
		tone = 'neutral'
	}: Props = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement;
	let pending = $state(false);
	const buttonClass = $derived(tone === 'danger' ? 'btn btn-danger' : 'btn btn-secondary');
</script>

<button type="button" class={buttonClass} onclick={() => dialog.showModal()}>{triggerLabel}</button>

<!-- Native modal dialog: focus trap, Escape and backdrop come with it. -->
<dialog
	bind:this={dialog}
	aria-labelledby="{id}-title"
	aria-describedby="{id}-description"
	class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-navy-950/60"
>
	<form
		method="POST"
		{action}
		class="p-6"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update();
				pending = false;
				dialog.close();
			};
		}}
	>
		<h2 id="{id}-title" class="text-xl font-semibold">{title}</h2>
		<p id="{id}-description" class="mt-2 text-sm text-ink-muted">{description}</p>
		<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
			<button type="button" class="btn btn-secondary" onclick={() => dialog.close()}>
				Annuler
			</button>
			<button class={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} disabled={pending}>
				{confirmLabel}
			</button>
		</div>
	</form>
</dialog>
