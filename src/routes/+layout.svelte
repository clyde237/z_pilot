<script lang="ts">
	import '@fontsource-variable/public-sans';
	import '@fontsource-variable/source-serif-4';
	import './layout.css';
	import favicon from '#lib/assets/favicon.png';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Z_Pilot · Hôtel Zingana</title>
</svelte:head>

{@render children()}
