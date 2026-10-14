import { z } from 'zod';

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const ISO_WEEKDAYS = [
	{ value: 1, label: 'Lundi' },
	{ value: 2, label: 'Mardi' },
	{ value: 3, label: 'Mercredi' },
	{ value: 4, label: 'Jeudi' },
	{ value: 5, label: 'Vendredi' },
	{ value: 6, label: 'Samedi' },
	{ value: 7, label: 'Dimanche' }
] as const;

/** Settings configuration by an admin (EF-EXP-04, EF-AUT-02, RG-01). */
export const settingsFormSchema = z.object({
	organizationName: z
		.string()
		.trim()
		.min(2, 'Le nom de l’organisation est obligatoire (au moins 2 caractères).')
		.max(100, 'Au plus 100 caractères.'),
	departmentName: z.string().trim().max(100, 'Au plus 100 caractères.').default(''),
	primaryColor: z
		.string()
		.trim()
		.regex(HEX_COLOR_PATTERN, 'Format hexadécimal invalide (ex: #072848).'),
	workingDays: z
		.array(z.coerce.number().int().min(1).max(7))
		.min(1, 'Sélectionnez au moins un jour ouvré.'),
	sessionDurationDays: z.coerce
		.number()
		.int()
		.min(1, 'La durée minimale est de 1 jour.')
		.max(90, 'La durée maximale est de 90 jours.')
});

export type SettingsFormInput = z.infer<typeof settingsFormSchema>;
