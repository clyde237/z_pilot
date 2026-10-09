// Account rules shared by the forms, the server and the bootstrap script.
// No `#lib` import here: scripts/create-admin.ts loads this file with plain Node.

/** Lowercase letters, digits, dot, hyphen, underscore; stored lowercase (DB check). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
export const USERNAME_RULE =
	'De 3 à 32 caractères : lettres minuscules sans accent, chiffres, point, tiret ou tiret bas.';

/** RG-14. */
export const PASSWORD_MIN_LENGTH = 8;
/** Bounds the hashing cost of a submitted password. */
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeUsername(raw: string): string {
	return raw.trim().toLowerCase();
}
