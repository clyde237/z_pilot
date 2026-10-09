<script lang="ts">
	import logo from '#lib/assets/brand/z-pilot-logo.webp';
</script>

<!-- Temporary home page until the login screen (lot 1). -->
<main class="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
	<div class="flex max-w-xl flex-col items-center gap-6 text-center">
		<!-- The logo text is navy: keep it on a light panel in dark mode too. -->
		<div class="w-full max-w-md rounded-2xl bg-cream p-6">
			<img src={logo} alt="" width="1197" height="612" class="h-auto w-full" />
		</div>
		<h1 class="sr-only">Z_Pilot — Hôtel Zingana</h1>
		<p class="rounded-full bg-surface-muted px-4 py-1 text-sm text-accent-ink">
			Application en cours de mise en place
		</p>
	</div>
</main>
