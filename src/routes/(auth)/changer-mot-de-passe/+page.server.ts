import { redirect } from '@sveltejs/kit';
import { fail, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { homePathFor } from '#lib/domain/roles.js';
import { initialPasswordSchema } from '#lib/schemas/auth.js';
import { requireUser } from '#lib/server/auth/access.js';
import { setInitialPassword } from '#lib/server/auth/password-change.js';
import { db } from '#lib/server/db/index.js';
import type { Actions, PageServerLoad } from './$types';

// EF-AUT-03: reached right after signing in with a temporary password.
export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	if (!user.mustChangePassword) redirect(303, '/profil');
	return { fullName: user.fullName, form: await superValidate(zod4(initialPasswordSchema)) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await superValidate(request, zod4(initialPasswordSchema));
		const { newPassword } = form.data;
		form.data.newPassword = '';
		form.data.confirmPassword = '';
		if (!form.valid) return fail(400, { form });

		await setInitialPassword(db, user.id, locals.sessionId!, newPassword);
		redirect(303, homePathFor(user));
	}
};
