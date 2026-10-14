<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Download from '@lucide/svelte/icons/download';
	import FileText from '@lucide/svelte/icons/file-text';
	import { formatWeekLabel } from '#lib/format.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(d: Date | string): string {
		return new Date(d).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Mes rapports · Z_Pilot</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<p class="eyebrow">Historique</p>
		<h1 class="mt-1 text-3xl font-semibold">Mes rapports hebdomadaires</h1>
		<p class="mt-1 text-ink-muted">
			Consultez vos rapports validés et publiés par le chef de département.
		</p>
	</div>

	{#if data.reports.length === 0}
		<div class="card flex flex-col items-center justify-center p-12 text-center">
			<span
				class="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink"
			>
				<FileText class="size-7" aria-hidden="true" />
			</span>
			<h2 class="mt-4 text-lg font-semibold">Aucun rapport publié pour l'instant</h2>
			<p class="mt-2 max-w-md text-sm text-ink-muted">
				Vos rapports hebdomadaires apparaîtront ici dès que le chef de département aura validé et
				publié votre activité de la semaine.
			</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.reports as report (report.id)}
				{@const weekLabel = formatWeekLabel(report.weekStart)}
				<div class="card flex flex-col justify-between p-5 transition hover:border-accent">
					<div>
						<div class="flex items-start justify-between gap-2">
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
							>
								Publié (v{report.version})
							</span>
							{#if report.progressPct !== null}
								<span class="text-lg font-bold text-accent-ink">
									{report.progressPct} %
								</span>
							{:else}
								<span class="text-xs text-ink-muted">Sans objectif</span>
							{/if}
						</div>

						<h2 class="mt-3 text-base font-semibold text-ink">
							{weekLabel}
						</h2>

						<p class="mt-2 text-xs text-ink-muted">
							Publié le {formatDate(report.publishedAt)} par {report.publisherName}
						</p>
					</div>

					<div class="mt-6 flex items-center justify-between border-t border-line pt-4">
						<a
							href={resolve('/api/export/hebdo/[id]', { id: report.id })}
							download
							class="btn btn-secondary inline-flex items-center gap-2 text-xs"
							title="Télécharger le document Word (.docx)"
						>
							<Download class="size-3.5" aria-hidden="true" />
							Word
						</a>

						<a
							href={resolve('/(app)/mes-rapports/[id]', { id: report.id })}
							class="btn btn-primary inline-flex items-center gap-1.5 text-xs"
						>
							Consulter
							<ArrowRight class="size-3.5" aria-hidden="true" />
						</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
