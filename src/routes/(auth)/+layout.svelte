<script lang="ts">
	import mark from '#lib/assets/brand/z-pilot-mark.webp';

	let { children } = $props();
</script>

<main class="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
	<div class="w-full max-w-md">
		<div class="mb-8 flex items-center justify-center gap-4">
			<img src={mark} alt="" width="507" height="507" class="size-16" />
			<div>
				<p class="font-serif text-3xl leading-none font-bold">Z_Pilot</p>
				<p class="mt-1 font-serif text-sm tracking-[0.2em] text-accent-ink uppercase">
					Hôtel Zingana
				</p>
			</div>
		</div>
		{@render children()}
	</div>
</main>
