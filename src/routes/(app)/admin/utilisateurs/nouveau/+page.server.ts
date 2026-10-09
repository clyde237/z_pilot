import { fail, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { UserFormMessage } from '#lib/components/users/UserForm.svelte';
import { userFormSchema, type UserFormInput } from '#lib/schemas/users.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { createAccount } from '#lib/server/users.js';
import { accountErrorResponse } from '../form-errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals, 'admin');
	return { form: await superValidate<UserFormInput, UserFormMessage>(zod4(userFormSchema)) };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const admin = requireUser(locals, 'admin');
		const form = await superValidate<UserFormInput, UserFormMessage>(request, zod4(userFormSchema));
		if (!form.valid) return fail(400, { form });

		const result = await createAccount(db, admin.id, form.data);
		if (!result.ok) return accountErrorResponse(form, result.error);

		// EF-USR-01: displayed once in the response, never stored in clear nor put in a URL.
		return {
			form,
			created: {
				userId: result.value.userId,
				fullName: form.data.fullName,
				username: form.data.username,
				temporaryPassword: result.value.temporaryPassword
			}
		};
	}
};
