import { error, fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { UserFormMessage } from '#lib/components/users/UserForm.svelte';
import { userFormSchema, type UserFormInput } from '#lib/schemas/users.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import {
	getAccount,
	resetAccountPassword,
	setAccountActive,
	updateAccount
} from '#lib/server/users.js';
import { accountErrorResponse } from '../form-errors';
import type { Actions, PageServerLoad } from './$types';

const accountIdSchema = z.uuid();

function accountIdFrom(params: { id: string }): string {
	const parsed = accountIdSchema.safeParse(params.id);
	if (!parsed.success) error(404, 'Compte introuvable');
	return parsed.data;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const admin = requireUser(locals, 'admin');
	const account = await getAccount(db, accountIdFrom(params));
	if (!account) error(404, 'Compte introuvable');

	const { fullName, username, isAdmin, isChef, participatesInReports } = account;
	return {
		account,
		isSelf: account.id === admin.id,
		form: await superValidate<UserFormInput, UserFormMessage>(
			{ fullName, username, isAdmin, isChef, participatesInReports },
			zod4(userFormSchema)
		)
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const admin = requireUser(locals, 'admin');
		const form = await superValidate<UserFormInput, UserFormMessage>(request, zod4(userFormSchema));
		if (!form.valid) return fail(400, { form });

		const result = await updateAccount(db, admin.id, accountIdFrom(params), form.data);
		if (!result.ok) return accountErrorResponse(form, result.error);
		return message(form, { tone: 'success', text: 'Modifications enregistrées.' });
	},

	deactivate: async ({ locals, params }) => {
		const admin = requireUser(locals, 'admin');
		const result = await setAccountActive(db, admin.id, accountIdFrom(params), false);
		if (!result.ok) return fail(400, { accountError: result.error.message });
		return { notice: 'Compte désactivé. Ses sessions ont été fermées.' };
	},

	reactivate: async ({ locals, params }) => {
		const admin = requireUser(locals, 'admin');
		const result = await setAccountActive(db, admin.id, accountIdFrom(params), true);
		if (!result.ok) return fail(400, { accountError: result.error.message });
		return { notice: 'Compte réactivé.' };
	},

	resetPassword: async ({ locals, params }) => {
		const admin = requireUser(locals, 'admin');
		const result = await resetAccountPassword(db, admin.id, accountIdFrom(params));
		if (!result.ok) return fail(400, { accountError: result.error.message });
		return { temporaryPassword: result.value.temporaryPassword };
	}
};
