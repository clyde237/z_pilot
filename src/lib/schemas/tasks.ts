import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Task creation schema for department head (EF-OBJ-01, EF-OBJ-04, EF-OBJ-05). */
export const createTaskSchema = z
	.object({
		title: z
			.string()
			.trim()
			.min(1, 'Le titre de la tâche est obligatoire.')
			.max(200, 'Au plus 200 caractères.'),
		description: z.string().trim().max(1000, 'Au plus 1000 caractères.').default(''),
		memberIds: z.array(z.string().uuid()).min(1, 'Sélectionnez au moins un membre.'),
		weekStart: z.string().regex(ISO_DATE_REGEX, 'Format de date invalide (YYYY-MM-DD).'),
		weight: z.coerce
			.number()
			.int()
			.min(1, 'Poids minimal : 1.')
			.max(3, 'Poids maximal : 3.')
			.default(1),
		plannedDay: z.coerce.number().int().min(1).max(7).nullable().optional().default(null),
		isQuantitative: z.boolean().default(false),
		targetValue: z.coerce
			.number()
			.positive('La cible doit être supérieure à 0.')
			.nullable()
			.optional(),
		unit: z.string().trim().max(30, 'Au plus 30 caractères.').nullable().optional()
	})
	.refine(
		(data) => {
			if (!data.isQuantitative) return true;
			return data.targetValue !== null && data.targetValue !== undefined && data.targetValue > 0;
		},
		{
			path: ['targetValue'],
			message: 'Renseignez une cible chiffrée supérieure à 0 pour une tâche quantitative.'
		}
	)
	.refine(
		(data) => {
			if (!data.isQuantitative) return true;
			return Boolean(data.unit && data.unit.length > 0);
		},
		{
			path: ['unit'],
			message: 'Renseignez l’unité de mesure (ex: tickets, dossiers, chambres).'
		}
	);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Task modification schema for department head (EF-OBJ-02). */
export const editTaskSchema = z
	.object({
		taskId: z.string().uuid(),
		title: z
			.string()
			.trim()
			.min(1, 'Le titre de la tâche est obligatoire.')
			.max(200, 'Au plus 200 caractères.'),
		description: z.string().trim().max(1000, 'Au plus 1000 caractères.').default(''),
		weight: z.coerce.number().int().min(1).max(3).default(1),
		plannedDay: z.coerce.number().int().min(1).max(7).nullable().optional().default(null),
		isQuantitative: z.boolean().default(false),
		targetValue: z.coerce
			.number()
			.positive('La cible doit être supérieure à 0.')
			.nullable()
			.optional(),
		unit: z.string().trim().max(30, 'Au plus 30 caractères.').nullable().optional()
	})
	.refine(
		(data) => {
			if (!data.isQuantitative) return true;
			return data.targetValue !== null && data.targetValue !== undefined && data.targetValue > 0;
		},
		{
			path: ['targetValue'],
			message: 'Renseignez une cible chiffrée supérieure à 0 pour une tâche quantitative.'
		}
	)
	.refine(
		(data) => {
			if (!data.isQuantitative) return true;
			return Boolean(data.unit && data.unit.length > 0);
		},
		{
			path: ['unit'],
			message: 'Renseignez l’unité de mesure.'
		}
	);

export type EditTaskInput = z.infer<typeof editTaskSchema>;

/** Member task check/progress update (EF-MEM-02, EF-MEM-03). */
export const updateMemberTaskSchema = z.object({
	taskId: z.string().uuid(),
	isDone: z.boolean(),
	achievedValue: z.coerce.number().min(0, 'Valeur minimale : 0.').optional(),
	doneOn: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
	note: z.string().trim().max(1000, 'Au plus 1000 caractères.').default('')
});

export type UpdateMemberTaskInput = z.infer<typeof updateMemberTaskSchema>;

/** Weekly difficulties schema (EF-MEM-04). */
export const weekDifficultiesSchema = z.object({
	weekStart: z.string().regex(ISO_DATE_REGEX),
	difficulties: z.string().trim().max(2000, 'Au plus 2000 caractères.').default('')
});

export type WeekDifficultiesInput = z.infer<typeof weekDifficultiesSchema>;
