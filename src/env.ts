import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'PostgreSQL connection string of the Neon branch for this environment (dev, preview, production).',
		schema: z.url({ protocol: /^postgres(ql)?$/ })
	},
	CRON_SECRET: {
		description:
			'Shared secret sent by Vercel Cron as `Authorization: Bearer <CRON_SECRET>` to /api/cron/daily.',
		schema: z.string().min(32)
	}
});
