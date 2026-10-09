<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import type { Snippet } from 'svelte';

	interface Props {
		tone: 'danger' | 'success';
		children: Snippet;
	}

	let { tone, children }: Props = $props();
</script>

<div
	role={tone === 'danger' ? 'alert' : 'status'}
	class={[
		'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
		tone === 'danger'
			? 'border-danger/30 bg-danger-soft text-danger'
			: 'border-success/30 bg-success-soft text-success'
	]}
>
	{#if tone === 'danger'}
		<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
	{:else}
		<CircleCheck class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
	{/if}
	<div class="min-w-0">{@render children()}</div>
</div>
