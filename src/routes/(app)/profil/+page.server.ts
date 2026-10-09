import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { changePasswordSchema } from '#lib/schemas/auth.js';
import { requireUser } from '#lib/server/auth/access.js';
import { changePassword } from '#lib/server/auth/password-change.js';
import { db } from '#lib/server/db/index.js';
import type { Actions, PageServerLoad } from './$types';

// EF-MEM-08 and EF-AUT-04.
export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { form: await superValidate(zod4(changePasswordSchema)) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await superValidate(request, zod4(changePasswordSchema));
		const { currentPassword, newPassword } = form.data;
		form.data = { currentPassword: '', newPassword: '', confirmPassword: '' };
		if (!form.valid) return fail(400, { form });

		const result = await changePassword(
			db,
			user.id,
			locals.sessionId!,
			currentPassword,
			newPassword
		);
		if (!result.ok) return setError(form, 'currentPassword', 'Mot de passe actuel incorrect.');

		return message(form, 'Mot de passe modifié. Vos autres appareils ont été déconnectés.');
	}
};
