<script lang="ts">
	import { enhance } from '$app/forms';
	import Bell from '@lucide/svelte/icons/bell';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import Check from '@lucide/svelte/icons/check';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import CheckSquare from '@lucide/svelte/icons/check-square';
	import Clock from '@lucide/svelte/icons/clock';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import { formatDateTime } from '#lib/format.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filterUnread = $state(false);
	let isSubmitting = $state(false);

	const displayedNotifications = $derived(
		filterUnread ? data.allNotifications.filter((n) => !n.readAt) : data.allNotifications
	);

	function getNotificationMeta(type: string) {
		switch (type) {
			case 'daily_reminder':
				return {
					label: 'Rappel d’activité',
					icon: Clock,
					color:
						'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
				};
			case 'task_assigned':
				return {
					label: 'Tâche assignée',
					icon: CheckSquare,
					color: 'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
				};
			case 'week_ready_to_close':
				return {
					label: 'Clôture hebdomadaire',
					icon: Calendar,
					color:
						'text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800'
				};
			case 'month_ready':
				return {
					label: 'Bilan mensuel',
					icon: CalendarRange,
					color: 'text-gold-500 bg-gold-50 border-gold-200 dark:bg-gold-950/40 dark:border-gold-800'
				};
			case 'weekly_report_published':
				return {
					label: 'Rapport publié',
					icon: FileText,
					color:
						'text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
				};
			default:
				return {
					label: 'Notification',
					icon: Bell,
					color: 'text-ink-muted bg-surface-muted border-line'
				};
		}
	}

	async function handleNavigate(id: string, link: string) {
		try {
			await fetch('/api/notifications/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
		} catch {
			// ignore network error
		}
		window.location.href = link;
	}
</script>

<svelte:head>
	<title>Notifications · Z_Pilot</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-2xl font-bold text-ink sm:text-3xl">Notifications</h1>
				{#if data.unreadCount > 0}
					<span class="text-on-accent rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold">
						{data.unreadCount} non lue{data.unreadCount > 1 ? 's' : ''}
					</span>
				{/if}
			</div>
			<p class="mt-1 text-sm text-ink-muted">
				Retrouvez l’ensemble de vos alertes, rappels de saisie et rapports d’activité.
			</p>
		</div>

		<!-- Action Tout marquer comme lu -->
		{#if data.unreadCount > 0}
			<form
				method="POST"
				action="?/markAllRead"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
			>
				<button type="submit" disabled={isSubmitting} class="btn btn-secondary text-xs sm:text-sm">
					<CheckCheck class="size-4" aria-hidden="true" />
					<span>Tout marquer comme lu</span>
				</button>
			</form>
		{/if}
	</div>

	<!-- Filter Tabs -->
	<div class="flex items-center gap-2 border-b border-line pb-3">
		<button
			type="button"
			class={[
				'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
				!filterUnread
					? 'bg-brand text-on-brand'
					: 'text-ink-muted hover:bg-surface-muted hover:text-ink'
			]}
			onclick={() => (filterUnread = false)}
		>
			Toutes ({data.allNotifications.length})
		</button>
		<button
			type="button"
			class={[
				'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
				filterUnread
					? 'bg-brand text-on-brand'
					: 'text-ink-muted hover:bg-surface-muted hover:text-ink'
			]}
			onclick={() => (filterUnread = true)}
		>
			Non lues ({data.unreadCount})
		</button>
	</div>

	<!-- Notifications List -->
	{#if displayedNotifications.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-12 text-center"
		>
			<div
				class="flex size-14 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
			>
				<Bell class="size-7" aria-hidden="true" />
			</div>
			<p class="mt-4 font-semibold text-ink">
				{filterUnread ? 'Aucune notification non lue' : 'Aucune notification'}
			</p>
			<p class="mt-1 text-xs text-ink-muted">
				{filterUnread
					? 'Toutes vos notifications sont à jour.'
					: 'Vous serez notifié dès qu’une tâche vous est assignée ou qu’un rapport est disponible.'}
			</p>
		</div>
	{:else}
		<ul class="space-y-3" role="list">
			{#each displayedNotifications as notif (notif.id)}
				{@const meta = getNotificationMeta(notif.type)}
				{@const IconComponent = meta.icon}
				<li
					class={[
						'relative flex flex-col gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
						notif.readAt ? 'border-line bg-surface' : 'border-accent/40 bg-accent-soft/10 shadow-xs'
					]}
				>
					<div class="flex items-start gap-3.5">
						<div
							class={[
								'flex size-10 shrink-0 items-center justify-center rounded-xl border',
								meta.color
							]}
							aria-hidden="true"
						>
							<IconComponent class="size-5" />
						</div>

						<div class="space-y-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-xs font-semibold text-ink-muted">
									{meta.label}
								</span>
								{#if !notif.readAt}
									<span class="size-2 rounded-full bg-accent" aria-label="Non lue"></span>
								{/if}
							</div>
							<p class="text-sm leading-snug font-medium text-ink">
								{notif.message}
							</p>
							<p class="font-mono text-xs text-ink-muted">
								{formatDateTime(new Date(notif.createdAt))}
							</p>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex shrink-0 items-center gap-2 self-end sm:self-center">
						{#if notif.link}
							<button
								type="button"
								class="btn btn-secondary px-3 py-1.5 text-xs font-semibold text-accent-ink"
								onclick={() => handleNavigate(notif.id, notif.link!)}
							>
								<span>Consulter</span>
								<ExternalLink class="size-3.5" aria-hidden="true" />
							</button>
						{/if}

						{#if !notif.readAt}
							<form
								method="POST"
								action="?/markRead"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={notif.id} />
								<button
									type="submit"
									class="btn btn-ghost px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink"
									title="Marquer comme lue"
								>
									<Check class="size-4" aria-hidden="true" />
									<span class="sr-only">Marquer comme lue</span>
								</button>
							</form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
