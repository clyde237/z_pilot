import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '#lib/domain/users.js';

const newPassword = z
	.string()
	.min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères.`)
	.max(PASSWORD_MAX_LENGTH, `Au plus ${PASSWORD_MAX_LENGTH} caractères.`);

export const loginSchema = z.object({
	username: z.string().trim().min(1, 'Saisissez votre nom d’utilisateur.').max(64),
	password: z.string().min(1, 'Saisissez votre mot de passe.').max(PASSWORD_MAX_LENGTH)
});

/** Forced change after a first sign-in or a reset (EF-AUT-03). */
export const initialPasswordSchema = z
	.object({
		newPassword,
		confirmPassword: z.string()
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		path: ['confirmPassword'],
		message: 'Les deux mots de passe ne correspondent pas.'
	});

/** Change from the profile page (EF-AUT-04): the current password is required. */
export const changePasswordSchema = z
	.object({
		currentPassword: z
			.string()
			.min(1, 'Saisissez votre mot de passe actuel.')
			.max(PASSWORD_MAX_LENGTH),
		newPassword,
		confirmPassword: z.string()
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		path: ['confirmPassword'],
		message: 'Les deux mots de passe ne correspondent pas.'
	})
	.refine((data) => data.newPassword !== data.currentPassword, {
		path: ['newPassword'],
		message: 'Le nouveau mot de passe doit être différent de l’actuel.'
	});
