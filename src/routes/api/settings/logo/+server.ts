import { getLogo } from '#lib/server/settings.js';
import { db } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const customLogo = await getLogo(db);
	if (!customLogo) {
		return new Response(null, { status: 404 });
	}

	return new Response(new Uint8Array(customLogo.buffer), {
		headers: {
			'Content-Type': customLogo.mimeType,
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
