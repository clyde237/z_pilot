const UNIQUE_VIOLATION = '23505';

/**
 * Name of the unique constraint violated by a failed query, or null for any other
 * error. The constraint is the real guarantee against duplicates; this only turns it
 * into a message for the user.
 */
export function violatedUniqueConstraint(error: unknown): string | null {
	// Drizzle wraps the driver error in `cause`.
	for (let current = error; current instanceof Error; current = current.cause) {
		if ('code' in current && current.code === UNIQUE_VIOLATION && 'constraint' in current) {
			return String(current.constraint);
		}
	}
	return null;
}
