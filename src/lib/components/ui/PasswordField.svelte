<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'type'> {
		label: string;
		name: string;
		value?: string;
		errors?: string[];
		hint?: string;
	}

	let { label, name, value = $bindable(''), errors, hint, ...inputProps }: Props = $props();

	const id = $props.id();
	let visible = $state(false);
	const describedBy = $derived(
		[errors?.length ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ')
	);
</script>

<div>
	<label class="field-label" for={id}>{label}</label>
	<div class="relative">
		<input
			{id}
			{name}
			type={visible ? 'text' : 'password'}
			class="input pr-12"
			bind:value
			autocapitalize="none"
			spellcheck="false"
			aria-invalid={errors?.length ? 'true' : undefined}
			aria-describedby={describedBy || undefined}
			{...inputProps}
		/>
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted hover:text-ink"
			aria-pressed={visible}
			aria-controls={id}
			onclick={() => (visible = !visible)}
		>
			{#if visible}<EyeOff class="size-5" aria-hidden="true" />{:else}<Eye
					class="size-5"
					aria-hidden="true"
				/>{/if}
			<span class="sr-only">{visible ? 'Masquer' : 'Afficher'} le mot de passe</span>
		</button>
	</div>
	{#if hint}<p id="{id}-hint" class="field-hint">{hint}</p>{/if}
	{#if errors?.length}<p id="{id}-error" class="field-error">{errors[0]}</p>{/if}
</div>
