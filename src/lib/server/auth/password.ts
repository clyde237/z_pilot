// No `#lib` import here: scripts/create-admin.ts loads this file with plain Node.
import { hash, verify } from '@node-rs/argon2';
import { randomBytes, randomInt } from 'node:crypto';

// @node-rs/argon2 defaults are argon2id with m = 19 MiB, t = 2, p = 1: the OWASP
// recommendation. Changing them later is safe, since every hash embeds its parameters.
export function hashPassword(password: string): Promise<string> {
	return hash(password);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	return verify(passwordHash, password);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the time of a real verification when the username is unknown, so response
 * times do not reveal which usernames exist.
 */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
	dummyHash ??= hash('z-pilot-dummy-password');
	await verify(await dummyHash, password);
}

/**
 * Hash of a random secret nobody knows: replaces a temporary password once it has been
 * used, which makes it single-use (RG-14).
 */
export function unusablePasswordHash(): Promise<string> {
	return hash(randomBytes(32).toString('base64url'));
}

// No 0/O, 1/l/I: the password is read on screen and typed by someone else.
const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const TEMPORARY_PASSWORD_GROUPS = 3;
const TEMPORARY_PASSWORD_GROUP_LENGTH = 4;

/** Temporary password shown once to the admin, e.g. `Xk7m-9PqR-t3Wz` (about 69 bits). */
export function generateTemporaryPassword(): string {
	return Array.from({ length: TEMPORARY_PASSWORD_GROUPS }, () =>
		Array.from(
			{ length: TEMPORARY_PASSWORD_GROUP_LENGTH },
			() => TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)]
		).join('')
	).join('-');
}
