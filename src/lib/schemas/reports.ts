import { z } from 'zod';

export const publishReportSchema = z.object({
	chefComment: z
		.string()
		.max(2000, 'Le commentaire ne peut pas dépasser 2 000 caractères.')
		.default(''),
	nextWeekCustomText: z
		.string()
		.max(2000, 'Le plan ne peut pas dépasser 2 000 caractères.')
		.default('')
});

export type PublishReportInput = z.infer<typeof publishReportSchema>;

export const reopenReportSchema = z.object({
	reopenedReason: z
		.string()
		.trim()
		.min(3, 'Le motif de réouverture est obligatoire (au moins 3 caractères).')
		.max(500, 'Le motif ne peut pas dépasser 500 caractères.')
});

export type ReopenReportInput = z.infer<typeof reopenReportSchema>;

export const generateMonthlyReportSchema = z.object({
	year: z.coerce.number().int().min(2020).max(2100),
	month: z.coerce.number().int().min(1).max(12),
	introText: z
		.string()
		.max(4000, 'L’introduction ne peut pas dépasser 4 000 caractères.')
		.default(''),
	conclusionText: z
		.string()
		.max(4000, 'La conclusion ne peut pas dépasser 4 000 caractères.')
		.default(''),
	allowMissing: z.coerce.boolean().default(false)
});

export type GenerateMonthlyReportInput = z.infer<typeof generateMonthlyReportSchema>;
