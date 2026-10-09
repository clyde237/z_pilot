import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { homePathFor } from '#lib/domain/roles.js';
import { formatTime } from '#lib/format.js';
import { loginSchema } from '#lib/schemas/auth.js';
import { PASSWORD_CHANGE_PATH, safeRedirectPath } from '#lib/server/auth/access.js';
import { authenticate } from '#lib/server/auth/login.js';
import { createSession, generateSessionToken, setSessionCookie } from '#lib/server/auth/session.js';
import { db } from '#lib/server/db/index.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, homePathFor(locals.user));
	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await superValidate(request, zod4(loginSchema));
		const { username, password } = form.data;
		// Never send a password back to the browser.
		form.data.password = '';
		if (!form.valid) return fail(400, { form });

		const result = await authenticate(db, username, password);
		if (!result.ok) {
			return result.reason === 'locked'
				? message(
						form,
						`Trop de tentatives échouées. Réessayez après ${formatTime(result.lockedUntil)}.`,
						{ status: 429 }
					)
				: message(form, 'Nom d’utilisateur ou mot de passe incorrect.', { status: 400 });
		}

		const token = generateSessionToken();
		const { expiresAt } = await createSession(db, result.userId, token);
		setSessionCookie(cookies, token, expiresAt);

		if (result.mustChangePassword) redirect(303, PASSWORD_CHANGE_PATH);
		redirect(303, safeRedirectPath(url.searchParams.get('redirectTo')) ?? '/');
	}
};
