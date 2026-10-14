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
