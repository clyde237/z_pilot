<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const title = $derived(
		page.status === 403
			? 'Accès refusé'
			: page.status === 404
				? 'Page introuvable'
				: page.status === 401
					? 'Connexion requise'
					: 'Une erreur est survenue'
	);
	const hint = $derived(
		page.status === 403
			? 'Cette page n’est pas disponible pour votre compte.'
			: page.status === 404
				? 'L’adresse demandée n’existe pas ou plus.'
				: page.status === 401
					? 'Votre session a expiré. Reconnectez-vous pour continuer.'
					: 'Réessayez dans un instant. Si le problème persiste, prévenez l’administrateur.'
	);
</script>

<svelte:head><title>{title} · Z_Pilot</title></svelte:head>

<div class="grid min-h-[60dvh] place-items-center px-4 py-12">
	<section class="card w-full max-w-md border-t-4 border-t-accent p-8 text-center">
		<p class="eyebrow">Erreur {page.status}</p>
		<h1 class="mt-2 text-3xl font-semibold">{title}</h1>
		<p class="mt-3 text-ink-muted">{hint}</p>
		<a
			class="btn btn-primary mt-6"
			href={page.status === 401 ? resolve('/(auth)/login') : resolve('/')}
		>
			{page.status === 401 ? 'Se connecter' : 'Retour à l’accueil'}
		</a>
	</section>
</div>
