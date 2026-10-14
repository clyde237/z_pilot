import { fail } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { settingsFormSchema, type SettingsFormInput } from '#lib/schemas/settings.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getSettings, updateSettings, type LogoUpload } from '#lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals, 'admin');
	const current = await getSettings(db);

	return {
		settings: current,
		form: await superValidate<SettingsFormInput, { tone: 'success' | 'danger'; text: string }>(
			{
				organizationName: current.organizationName,
				departmentName: current.departmentName ?? '',
				primaryColor: current.primaryColor,
				workingDays: current.workingDays,
				sessionDurationDays: current.sessionDurationDays
			},
			zod4(settingsFormSchema)
		)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const admin = requireUser(locals, 'admin');
		const formData = await request.formData();
		const form = await superValidate<
			SettingsFormInput,
			{ tone: 'success' | 'danger'; text: string }
		>(formData, zod4(settingsFormSchema));

		if (!form.valid) return fail(400, { form });

		const logoFile = formData.get('logo') as File | null;
		const removeLogo = formData.get('removeLogo') === 'true';

		let newLogo: LogoUpload | null = null;
		if (logoFile && logoFile.size > 0) {
			if (logoFile.size > MAX_LOGO_BYTES) {
				return setError(form, 'primaryColor', 'Le logo ne doit pas dépasser 2 Mo.');
			}
			if (!ALLOWED_MIME_TYPES.includes(logoFile.type)) {
				return setError(
					form,
					'primaryColor',
					'Format d’image non supporté (formats acceptés : PNG, JPEG, WebP, SVG).'
				);
			}
			newLogo = {
				buffer: Buffer.from(await logoFile.arrayBuffer()),
				mimeType: logoFile.type
			};
		}

		await updateSettings(db, admin.id, form.data, { newLogo, removeLogo });

		return message(form, { tone: 'success', text: 'Paramètres enregistrés avec succès.' });
	}
};
