<script lang="ts">
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';

	let { data } = $props();

	const firstName = $derived(data.user.fullName.split(/\s+/)[0]);
</script>

<svelte:head><title>Mon espace · Z_Pilot</title></svelte:head>

<p class="eyebrow">Mon espace</p>
<h1 class="mt-2 text-4xl font-semibold">Bonjour, {firstName}</h1>
<p class="mt-2 text-ink-muted">Suivez l’avancement de vos tâches de la semaine.</p>

<!-- Placeholder until lot 2 (tasks, progress, notes, difficulties). -->
<section class="card mt-8 flex items-start gap-4 p-6">
	<span
		class="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink"
	>
		<CalendarCheck class="size-6" aria-hidden="true" />
	</span>
	<div>
		<h2 class="text-xl font-semibold">Vos tâches arrivent bientôt</h2>
		<p class="mt-1 text-ink-muted">
			La liste des tâches de la semaine, la barre de progression et la saisie des difficultés seront
			disponibles ici dès que le chef de département aura défini vos objectifs.
		</p>
	</div>
</section>
