<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		label: string;
		name: string;
		value?: string;
		errors?: string[];
		hint?: string;
	}

	let { label, name, value = $bindable(''), errors, hint, ...inputProps }: Props = $props();

	const id = $props.id();
	const describedBy = $derived(
		[errors?.length ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ')
	);
</script>

<div>
	<label class="field-label" for={id}>{label}</label>
	<input
		{id}
		{name}
		class="input"
		bind:value
		aria-invalid={errors?.length ? 'true' : undefined}
		aria-describedby={describedBy || undefined}
		{...inputProps}
	/>
	{#if hint}<p id="{id}-hint" class="field-hint">{hint}</p>{/if}
	{#if errors?.length}<p id="{id}-error" class="field-error">{errors[0]}</p>{/if}
</div>
