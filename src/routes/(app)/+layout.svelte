<script lang="ts">
	import { resolve } from '$app/paths';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { MediaQuery } from 'svelte/reactivity';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import mark from '#lib/assets/brand/z-pilot-mark.webp';
	import { roleLabels } from '#lib/domain/roles.js';
	import { initialsOf } from '#lib/format.js';
	import { NAVIGATION_SECTIONS, navigationFor } from '#lib/navigation.js';

	let { data, children } = $props();

	// Below lg the sidebar is a drawer; true on the server so a desktop first paint stays usable.
	const desktop = new MediaQuery('min-width: 1024px', true);
	let menuOpen = $state(false);

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

	afterNavigate(() => (menuOpen = false));
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (menuOpen = false)} />

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
