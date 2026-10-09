import { describe, expect, it } from 'vitest';
import {
	generateTemporaryPassword,
	hashPassword,
	unusablePasswordHash,
	verifyPassword
} from './password';

describe('password hashing', () => {
	it('uses argon2id and verifies only the right password', async () => {
		const passwordHash = await hashPassword('correct horse');
		expect(passwordHash).toMatch(/^\$argon2id\$/);
		expect(await verifyPassword(passwordHash, 'correct horse')).toBe(true);
		expect(await verifyPassword(passwordHash, 'Correct horse')).toBe(false);
	});

	it('produces an unusable hash that no known password matches', async () => {
		const passwordHash = await unusablePasswordHash();
		expect(await verifyPassword(passwordHash, '')).toBe(false);
	});
});

describe('generateTemporaryPassword', () => {
	it('uses three groups of four unambiguous characters', () => {
		for (let run = 0; run < 200; run++) {
			expect(generateTemporaryPassword()).toMatch(
				/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/
			);
		}
	});

	it('does not repeat itself', () => {
		const passwords = new Set(Array.from({ length: 1000 }, generateTemporaryPassword));
		expect(passwords.size).toBe(1000);
	});
});
