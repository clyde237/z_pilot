<script lang="ts">
	import { resolve } from '$app/paths';
	import Bell from '@lucide/svelte/icons/bell';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import CheckSquare from '@lucide/svelte/icons/check-square';
	import Clock from '@lucide/svelte/icons/clock';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import mark from '#lib/assets/brand/z-pilot-mark.webp';
	import { roleLabels } from '#lib/domain/roles.js';
	import { formatDateTime, initialsOf } from '#lib/format.js';
	import { NAVIGATION_SECTIONS, navigationFor } from '#lib/navigation.js';

	let { data, children } = $props();

	// Below lg the sidebar is a drawer; true on the server so a desktop first paint stays usable.
	const desktop = new MediaQuery('min-width: 1024px', true);
	let menuOpen = $state(false);
	let notifPanelOpen = $state(false);
	let notifContainerRef = $state<HTMLDivElement | null>(null);

	const sections = $derived.by(() => {
		const items = navigationFor(data.user);
		return NAVIGATION_SECTIONS.map((section) => ({
			section,
			items: items.filter((item) => item.section === section)
		})).filter((group) => group.items.length > 0);
	});

	// Compares route IDs: an entry stays highlighted on its sub-pages.
	function isCurrent(route: string): boolean {
		const current = page.route.id ?? '';
		return current === route || current.startsWith(`${route}/`);
	}

	function getNotificationIcon(type: string) {
		switch (type) {
			case 'daily_reminder':
				return Clock;
			case 'task_assigned':
				return CheckSquare;
			case 'week_ready_to_close':
				return Calendar;
			case 'month_ready':
				return CalendarRange;
			case 'weekly_report_published':
				return FileText;
			default:
				return Bell;
		}
	}

	async function handleMarkAsRead(id: string, link: string | null) {
		try {
			await fetch('/api/notifications/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			await invalidateAll();
		} catch {
			// ignore network error
		}
		notifPanelOpen = false;
		if (link) {
			window.location.href = link;
		}
	}

	async function handleMarkAllAsRead() {
		try {
			await fetch('/api/notifications/read-all', {
				method: 'POST'
			});
			await invalidateAll();
		} catch {
			// ignore network error
		}
	}

	afterNavigate(() => {
		menuOpen = false;
		notifPanelOpen = false;
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			menuOpen = false;
			notifPanelOpen = false;
		}
	}}
	onclick={(event) => {
		if (notifPanelOpen && notifContainerRef && !notifContainerRef.contains(event.target as Node)) {
			notifPanelOpen = false;
		}
	}}
/>

<a
	href="#contenu"
	class="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
>
	Aller au contenu
</a>

<div class="min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
	{#if menuOpen && !desktop.current}
		<button
			type="button"
			class="fixed inset-0 z-30 bg-navy-950/60"
			aria-label="Fermer le menu"
			onclick={() => (menuOpen = false)}
		></button>
	{/if}

	<aside
		id="app-sidebar"
		class={[
			'fixed inset-y-0 left-0 z-40 flex w-[17.5rem] flex-col bg-sidebar text-sidebar-ink transition-transform duration-200',
			'lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
			menuOpen ? 'translate-x-0' : '-translate-x-full'
		]}
		inert={!desktop.current && !menuOpen}
		aria-label="Menu principal"
	>
		<div class="flex items-center gap-3 border-b border-white/10 px-5 py-6">
			<img src={mark} alt="" width="507" height="507" class="size-14 shrink-0" />
			<div class="min-w-0">
				<p class="font-serif text-2xl leading-tight font-bold">Z_Pilot</p>
				<p class="font-serif text-sm text-gold-400">Hôtel Zingana</p>
				<p class="text-xs text-sidebar-ink/70">Bafoussam</p>
			</div>
			<button
				type="button"
				class="ml-auto flex size-11 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"
				onclick={() => (menuOpen = false)}
			>
				<X class="size-5" aria-hidden="true" />
				<span class="sr-only">Fermer le menu</span>
			</button>
		</div>

		<nav class="flex-1 overflow-y-auto py-4" aria-label="Navigation principale">
			{#each sections as { section, items } (section)}
				<p
					class="px-6 pt-4 pb-2 text-xs font-semibold tracking-[0.18em] text-gold-400/80 uppercase"
				>
					{section}
				</p>
				<ul>
					{#each items as item (item.route)}
						{@const current = isCurrent(item.route)}
						<li>
							<a
								href={resolve(item.route)}
								aria-current={current ? 'page' : undefined}
								class={[
									'flex min-h-12 items-center gap-3 border-l-4 px-5 text-[0.95rem] transition-colors',
									current
										? 'border-gold-500 bg-sidebar-active font-semibold text-gold-400'
										: 'border-transparent text-sidebar-ink/90 hover:bg-white/5 hover:text-sidebar-ink'
								]}
							>
								<item.icon class="size-5 shrink-0" aria-hidden="true" />
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>

		<!-- Echo of the batik pattern of the logo. -->
		<div class="batik-band h-10 shrink-0 opacity-70" aria-hidden="true"></div>
		<p class="px-5 py-4 text-xs text-sidebar-ink/70">Hospitalité · Excellence · Bafoussam</p>
	</aside>

	<div class="flex min-w-0 flex-col">
		<header
			class="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:px-8"
		>
			<button
				type="button"
				class="flex size-11 items-center justify-center rounded-lg border border-line bg-surface lg:hidden"
				aria-controls="app-sidebar"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = true)}
			>
				<Menu class="size-5" aria-hidden="true" />
				<span class="sr-only">Ouvrir le menu</span>
			</button>
			<p class="min-w-0 truncate">
				<span class="font-serif text-lg font-semibold">Hôtel Zingana</span>
				<span class="hidden text-ink-muted sm:inline"> · Suivi des activités</span>
			</p>

			<div class="ml-auto flex items-center gap-2">
				<!-- Notification Bell & Dropdown (EF-NOT-01) -->
				<div class="relative" bind:this={notifContainerRef}>
					<button
						type="button"
						class="relative flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
						aria-label="Notifications"
						aria-expanded={notifPanelOpen}
						onclick={() => (notifPanelOpen = !notifPanelOpen)}
					>
						<Bell class="size-5" aria-hidden="true" />
						{#if data.unreadCount > 0}
							<span
								class="text-on-accent absolute top-2 right-2 flex size-4 animate-pulse items-center justify-center rounded-full bg-accent text-[10px] font-bold"
							>
								{data.unreadCount > 9 ? '9+' : data.unreadCount}
							</span>
						{/if}
					</button>

					{#if notifPanelOpen}
						<div
							class="absolute top-full right-0 z-50 mt-2 w-80 rounded-2xl border border-line bg-surface p-4 text-left shadow-xl sm:w-96"
							role="region"
							aria-label="Panneau des notifications"
						>
							<div class="flex items-center justify-between border-b border-line pb-3">
								<div class="flex items-center gap-2">
									<p class="text-sm font-semibold text-ink">Notifications</p>
									{#if data.unreadCount > 0}
										<span
											class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-ink"
										>
											{data.unreadCount}
										</span>
									{/if}
								</div>
								{#if data.unreadCount > 0}
									<button
										type="button"
										class="flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
										onclick={handleMarkAllAsRead}
									>
										<CheckCheck class="size-3.5" aria-hidden="true" />
										<span>Tout marquer lu</span>
									</button>
								{/if}
							</div>

							<div class="max-h-80 divide-y divide-line/40 overflow-y-auto py-2">
								{#if data.recentNotifications.length === 0}
									<div class="py-8 text-center">
										<p class="text-xs text-ink-muted">Aucune notification pour le moment.</p>
									</div>
								{:else}
									{#each data.recentNotifications as notif (notif.id)}
										{@const IconComponent = getNotificationIcon(notif.type)}
										<div
											class={[
												'flex items-start gap-3 rounded-xl p-2.5 transition-colors',
												notif.readAt
													? 'hover:bg-surface-muted/50'
													: 'bg-accent-soft/20 hover:bg-accent-soft/30'
											]}
										>
											<div class="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true">
												<IconComponent class="size-4" />
											</div>
											<div class="min-w-0 flex-1 space-y-1">
												<button
													type="button"
													class="block w-full cursor-pointer text-left text-xs leading-snug font-medium text-ink hover:underline"
													onclick={() => handleMarkAsRead(notif.id, notif.link)}
												>
													{notif.message}
												</button>
												<div
													class="flex items-center justify-between font-mono text-[11px] text-ink-muted"
												>
													<span>{formatDateTime(new Date(notif.createdAt))}</span>
													{#if !notif.readAt}
														<span class="size-1.5 rounded-full bg-accent" aria-label="Non lue"
														></span>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>

							<div class="border-t border-line pt-2 text-center">
								<a
									href={resolve('/(app)/notifications')}
									class="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline"
									onclick={() => (notifPanelOpen = false)}
								>
									<span>Voir toutes les notifications</span>
									<ExternalLink class="size-3" aria-hidden="true" />
								</a>
							</div>
						</div>
					{/if}
				</div>

				<a
					href={resolve('/(app)/profil')}
					class="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-surface-muted"
					title="Mon profil"
				>
					<span
						class="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand"
						aria-hidden="true">{initialsOf(data.user.fullName)}</span
					>
					<span class="hidden text-left leading-tight md:block">
						<span class="block text-sm font-semibold">{data.user.fullName}</span>
						<span class="block text-xs text-ink-muted">{roleLabels(data.user).join(' · ')}</span>
					</span>
				</a>
				<form method="POST" action="/logout">
					<button
						class="flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
						title="Se déconnecter"
					>
						<LogOut class="size-5" aria-hidden="true" />
						<span class="sr-only">Se déconnecter</span>
					</button>
				</form>
			</div>
		</header>

		<main id="contenu" class="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.batik-band {
		background-image:
			radial-gradient(circle at 50% 50%, var(--color-gold-400) 1.5px, transparent 2px),
			linear-gradient(
				45deg,
				transparent 46%,
				var(--color-gold-500) 47%,
				var(--color-gold-500) 53%,
				transparent 54%
			),
			linear-gradient(
				-45deg,
				transparent 46%,
				var(--color-gold-500) 47%,
				var(--color-gold-500) 53%,
				transparent 54%
			);
		background-size: 20px 20px;
		border-block: 1px solid var(--color-gold-500);
	}
</style>
